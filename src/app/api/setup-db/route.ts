import { NextResponse } from "next/server";

// One-time DB setup endpoint.
// Tries multiple methods to execute DDL against Supabase:
//   1. Management API (requires SUPABASE_ACCESS_TOKEN)
//   2. Service role key via /pg/query
//   3. Service role key via PostgREST RPC
// Call once after deploying: GET https://meter.chat/api/setup-db

const SCHEMA_SQL = `
-- Users
create table if not exists meter_users (
  id text primary key,
  email text unique not null,
  stripe_customer_id text,
  card_last4 text,
  card_brand text,
  gmail_connected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Passkey credentials
create table if not exists passkey_credentials (
  credential_id text primary key,
  user_id text not null references meter_users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  backed_up boolean default false,
  transports jsonb,
  created_at timestamptz default now()
);

-- Auth challenges (WebAuthn)
create table if not exists auth_challenges (
  id text primary key,
  email text not null,
  challenge text not null,
  type text not null check (type in ('register', 'login')),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Chat sessions
create table if not exists chat_sessions (
  id text primary key,
  user_id text not null,
  project_name text not null,
  total_cost numeric default 0,
  today_cost numeric default 0,
  today_tokens_in integer default 0,
  today_tokens_out integer default 0,
  today_message_count integer default 0,
  today_date text,
  daily_limit numeric,
  monthly_limit numeric,
  per_txn_limit numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages
create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  model text, tokens_in integer, tokens_out integer,
  cost numeric, confidence numeric,
  settled boolean default false, receipt_status text,
  signature text, tx_hash text, cards jsonb,
  timestamp bigint not null,
  created_at timestamptz default now()
);

-- Workspaces
create table if not exists workspaces (
  id text primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz default now()
);

-- Workspace projects
create table if not exists workspace_projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Decisions
create table if not exists decisions (
  id text primary key,
  user_id text not null,
  title text not null,
  status text not null default 'undecided',
  archived boolean default false,
  choice text, alternatives jsonb, reasoning text,
  project_id text, chat_message_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Settlement history
create table if not exists settlement_history (
  id text primary key,
  user_id text not null references meter_users(id) on delete cascade,
  workspace_id text,
  amount numeric not null,
  stripe_payment_intent_id text,
  tx_hash text,
  message_count integer default 0,
  charge_count integer default 0,
  card_last4 text,
  card_brand text,
  status text not null default 'succeeded',
  created_at timestamptz default now()
);

-- OAuth tokens (encrypted, workspace-scoped)
create table if not exists oauth_tokens (
  id text primary key,
  user_id text not null references meter_users(id) on delete cascade,
  provider text not null,
  workspace_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider, workspace_id)
);

-- OAuth state (CSRF protection)
create table if not exists oauth_state (
  id text primary key,
  user_id text not null,
  provider text not null,
  workspace_id text,
  pkce_verifier text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_oauth_tokens_user on oauth_tokens(user_id);
create index if not exists idx_oauth_tokens_workspace on oauth_tokens(workspace_id);
create index if not exists idx_oauth_state_expires on oauth_state(expires_at);
create index if not exists idx_meter_users_email on meter_users(email);
create index if not exists idx_passkey_credentials_user on passkey_credentials(user_id);
create index if not exists idx_auth_challenges_email on auth_challenges(email);
create index if not exists idx_chat_messages_session on chat_messages(session_id);
create index if not exists idx_chat_sessions_user on chat_sessions(user_id);
create index if not exists idx_workspaces_user on workspaces(user_id);
create index if not exists idx_decisions_user on decisions(user_id);
create index if not exists idx_settlement_history_user on settlement_history(user_id);
create index if not exists idx_settlement_history_workspace on settlement_history(workspace_id);

-- Alter statements for existing deployments
alter table chat_sessions add column if not exists daily_limit numeric;
alter table chat_sessions add column if not exists monthly_limit numeric;
alter table chat_sessions add column if not exists per_txn_limit numeric;
alter table settlement_history add column if not exists workspace_id text;
alter table oauth_tokens add column if not exists metadata jsonb;
`;

// Extract project ref from Supabase URL (e.g. "yzjevhsacvqbcygbmewk" from "https://yzjevhsacvqbcygbmewk.supabase.co")
function getProjectRef(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!url) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  // Method 1: Management API (most reliable, works on all Supabase projects)
  if (accessToken) {
    const ref = getProjectRef(url);
    if (ref) {
      try {
        const res = await fetch(
          `https://api.supabase.com/v1/projects/${ref}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ query: SCHEMA_SQL }),
          }
        );

        if (res.ok) {
          return NextResponse.json({
            success: true,
            method: "management-api",
            message: "All tables and indexes created successfully",
          });
        }

        const errText = await res.text().catch(() => "unknown");
        // Fall through to other methods
        console.error("Management API failed:", res.status, errText);
      } catch (err) {
        console.error("Management API error:", err);
      }
    }
  }

  // Method 2: Service role key — try each statement individually
  if (serviceKey) {
    const statements = SCHEMA_SQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    const results: { sql: string; ok: boolean; error?: string }[] = [];

    for (const sql of statements) {
      const label = sql.replace(/\s+/g, " ").trim().slice(0, 80);
      try {
        // Try /pg/query endpoint first (Supabase Dashboard's internal endpoint)
        const pgRes = await fetch(`${url}/pg/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: sql }),
        });

        if (pgRes.ok) {
          results.push({ sql: label, ok: true });
          continue;
        }

        // Try PostgREST RPC (requires exec_sql function to exist)
        const rpcRes = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ query: sql }),
        });

        if (rpcRes.ok) {
          results.push({ sql: label, ok: true });
        } else {
          const errText = await rpcRes.text().catch(() => "unknown");
          results.push({ sql: label, ok: false, error: errText });
        }
      } catch (err) {
        results.push({
          sql: label,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const allOk = results.every((r) => r.ok);
    return NextResponse.json({
      success: allOk,
      method: "service-role",
      results,
      ...(allOk
        ? {}
        : {
            help: "If tables failed: paste the SQL from supabase-schema.sql into your Supabase SQL Editor, or set SUPABASE_ACCESS_TOKEN (personal access token from supabase.com/dashboard/account/tokens)",
          }),
    });
  }

  return NextResponse.json(
    {
      error: "No Supabase credentials configured",
      help: "Set one of: SUPABASE_ACCESS_TOKEN (personal access token — recommended) or SUPABASE_SERVICE_ROLE_KEY in your Vercel env vars. Get your access token at https://supabase.com/dashboard/account/tokens",
    },
    { status: 500 }
  );
}
