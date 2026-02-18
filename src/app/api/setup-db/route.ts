import { NextResponse } from "next/server";

// One-time DB setup endpoint.
// Uses Supabase's internal SQL execution endpoint (same as the SQL Editor).
// Call once after deploying: GET https://meter.chat/api/setup-db

const SCHEMA_STATEMENTS = [
  `create table if not exists meter_users (
    id text primary key,
    email text unique not null,
    stripe_customer_id text,
    card_last4 text,
    card_brand text,
    gmail_connected boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`,
  `create table if not exists passkey_credentials (
    credential_id text primary key,
    user_id text not null references meter_users(id) on delete cascade,
    public_key text not null,
    counter bigint not null default 0,
    device_type text,
    backed_up boolean default false,
    transports jsonb,
    created_at timestamptz default now()
  )`,
  `create table if not exists auth_challenges (
    id text primary key,
    email text not null,
    challenge text not null,
    type text not null check (type in ('register', 'login')),
    expires_at timestamptz not null,
    created_at timestamptz default now()
  )`,
  `create table if not exists chat_sessions (
    id text primary key,
    user_id text not null,
    project_name text not null,
    total_cost numeric default 0,
    today_cost numeric default 0,
    today_tokens_in integer default 0,
    today_tokens_out integer default 0,
    today_message_count integer default 0,
    today_date text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`,
  `create table if not exists chat_messages (
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
  )`,
  `create table if not exists workspaces (
    id text primary key,
    user_id text not null,
    name text not null,
    created_at timestamptz default now()
  )`,
  `create table if not exists workspace_projects (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    name text not null,
    created_at timestamptz default now()
  )`,
  `create table if not exists decisions (
    id text primary key,
    user_id text not null,
    title text not null,
    status text not null default 'undecided',
    archived boolean default false,
    choice text, alternatives jsonb, reasoning text,
    project_id text, chat_message_id text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`,
  `create index if not exists idx_meter_users_email on meter_users(email)`,
  `create index if not exists idx_passkey_credentials_user on passkey_credentials(user_id)`,
  `create index if not exists idx_auth_challenges_email on auth_challenges(email)`,
  `create index if not exists idx_chat_messages_session on chat_messages(session_id)`,
  `create index if not exists idx_chat_sessions_user on chat_sessions(user_id)`,
  `create index if not exists idx_workspaces_user on workspaces(user_id)`,
  `create index if not exists idx_decisions_user on decisions(user_id)`,
];

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error: "Missing env vars",
        help: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars",
      },
      { status: 500 }
    );
  }

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of SCHEMA_STATEMENTS) {
    const label = sql.replace(/\s+/g, " ").trim().slice(0, 80);
    try {
      // Use Supabase's internal SQL execution endpoint (same as Dashboard SQL Editor)
      const res = await fetch(`${url}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name: "exec_sql", args: { query: sql } }),
      });

      // If exec_sql RPC doesn't exist, fall back to raw pg endpoint
      if (!res.ok) {
        // Try the pg/query endpoint (available in recent Supabase versions)
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
        } else {
          const pgErr = await pgRes.text().catch(() => "unknown error");
          results.push({ sql: label, ok: false, error: pgErr });
        }
      } else {
        results.push({ sql: label, ok: true });
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
    results,
    ...(allOk ? {} : { help: "If tables failed to create, paste the contents of supabase-schema.sql into your Supabase SQL Editor" }),
  });
}
