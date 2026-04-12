-- Internal PIP — Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- Agent Jobs
-- =====================
create table if not exists agent_jobs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  agent_id      text not null,                        -- e.g. 'ad-creative'
  status        text not null default 'idle'          -- idle | running | completed | error
                check (status in ('idle', 'running', 'completed', 'error')),
  input         jsonb not null default '{}',
  output        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- RLS: users only see their own jobs
alter table agent_jobs enable row level security;

create policy "Users can read own jobs"
  on agent_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on agent_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own jobs"
  on agent_jobs for update
  using (auth.uid() = user_id);

-- =====================
-- Integration Tokens
-- (encrypted storage for OAuth tokens per user)
-- =====================
create table if not exists integration_tokens (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  provider       text not null,   -- 'meta' | 'google' | 'zoom' | 'slack' | 'ghl' etc.
  access_token   text,
  refresh_token  text,
  token_expires_at timestamptz,
  scopes         text[],
  metadata       jsonb default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, provider)
);

alter table integration_tokens enable row level security;

create policy "Users can manage own tokens"
  on integration_tokens for all
  using (auth.uid() = user_id);

-- =====================
-- Indexes
-- =====================
create index agent_jobs_user_id_idx on agent_jobs (user_id);
create index agent_jobs_agent_id_idx on agent_jobs (agent_id);
create index agent_jobs_status_idx on agent_jobs (status);
create index integration_tokens_user_provider_idx on integration_tokens (user_id, provider);
