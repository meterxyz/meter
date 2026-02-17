-- Meter: Eternal sessions schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

-- Chat sessions (one per project thread)
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages
create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  model text,
  tokens_in integer,
  tokens_out integer,
  cost numeric,
  confidence numeric,
  settled boolean default false,
  receipt_status text,
  signature text,
  tx_hash text,
  cards jsonb,
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

-- Workspace projects / tracks
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
  choice text,
  alternatives jsonb,
  reasoning text,
  project_id text,
  chat_message_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_chat_messages_session on chat_messages(session_id);
create index if not exists idx_chat_messages_timestamp on chat_messages(timestamp);
create index if not exists idx_chat_sessions_user on chat_sessions(user_id);
create index if not exists idx_workspaces_user on workspaces(user_id);
create index if not exists idx_workspace_projects_workspace on workspace_projects(workspace_id);
create index if not exists idx_decisions_user on decisions(user_id);
