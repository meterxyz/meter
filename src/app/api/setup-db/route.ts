import { NextResponse } from "next/server";

// One-time DB setup endpoint.
// Uses the Supabase Management API (requires SUPABASE_ACCESS_TOKEN).
// Call once after deploying: GET https://meter.chat/api/setup-db

// Phase 1: Create all tables
const TABLES_SQL = `
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

create table if not exists auth_challenges (
  id text primary key,
  email text not null,
  challenge text not null,
  type text not null check (type in ('register', 'login')),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

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

create table if not exists workspaces (
  id text primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists workspace_projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

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

create table if not exists oauth_state (
  id text primary key,
  user_id text not null,
  provider text not null,
  workspace_id text,
  pkce_verifier text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
`;

// Phase 2: Add columns that may be missing on existing deployments
const ALTERS_SQL = `
alter table chat_sessions add column if not exists daily_limit numeric;
alter table chat_sessions add column if not exists monthly_limit numeric;
alter table chat_sessions add column if not exists per_txn_limit numeric;
alter table settlement_history add column if not exists workspace_id text;
alter table oauth_tokens add column if not exists metadata jsonb;
`;

// Phase 3: Create indexes (columns must exist first)
const INDEXES_SQL = `
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
`;

function getProjectRef(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function runQuery(
  ref: string,
  accessToken: string,
  sql: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (res.ok) return { ok: true };
  const errText = await res.text().catch(() => "unknown");
  return { ok: false, error: `${res.status}: ${errText}` };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!url) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "SUPABASE_ACCESS_TOKEN is not configured",
        help: "Set SUPABASE_ACCESS_TOKEN in your env vars, then call GET /api/setup-db again. Get your personal access token at https://supabase.com/dashboard/account/tokens. Alternatively, copy the SQL below and paste it into your Supabase SQL Editor.",
        schema: TABLES_SQL + ALTERS_SQL + INDEXES_SQL,
      },
      { status: 400 },
    );
  }

  const ref = getProjectRef(url);
  if (!ref) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL. Expected format: https://<ref>.supabase.co",
      },
      { status: 400 },
    );
  }

  const phases = [
    { name: "tables", sql: TABLES_SQL },
    { name: "alters", sql: ALTERS_SQL },
    { name: "indexes", sql: INDEXES_SQL },
  ];

  const results: { phase: string; ok: boolean; error?: string }[] = [];

  for (const phase of phases) {
    try {
      const result = await runQuery(ref, accessToken, phase.sql);
      results.push({ phase: phase.name, ...result });
      if (!result.ok) break; // stop on first failure
    } catch (err) {
      results.push({
        phase: phase.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    {
      success: allOk,
      method: "management-api",
      ...(allOk
        ? { message: "All tables, columns, and indexes created successfully" }
        : { help: "Check the failed phase below. You can also paste the SQL manually into your Supabase SQL Editor." }),
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
