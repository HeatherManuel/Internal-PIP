-- Internal PIP — Drive plain-text content store
-- Drops any legacy tables from earlier iterations, then creates a simple
-- table that holds raw extracted text for each source file.
-- No embeddings, no vectors — just text ready for later use.

drop table if exists voice_content_chunks cascade;
drop table if exists drive_sync_log        cascade;
drop table if exists drive_file_config     cascade;

create table if not exists drive_content (
  id           uuid        primary key default gen_random_uuid(),
  file_id      text        not null unique,
  file_name    text        not null,
  content_type text        not null
                           check (content_type in (
                             'voice_training',
                             'curriculum_reference',
                             'market_research'
                           )),
  raw_text     text,
  char_count   int         generated always as (length(raw_text)) stored,
  synced_at    timestamptz,
  error        text,
  updated_at   timestamptz not null default now()
);

alter table drive_content enable row level security;

create policy "Service role full access"
  on drive_content for all
  using (auth.role() = 'service_role');

create policy "Authenticated read"
  on drive_content for select
  using (auth.role() = 'authenticated');

create index drive_content_content_type_idx on drive_content (content_type);
create index drive_content_synced_at_idx    on drive_content (synced_at);
