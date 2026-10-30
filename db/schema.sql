create table if not exists matches (
  id              uuid primary key,
  version         integer      not null,
  played_at       timestamptz  not null,
  uploaded_at     timestamptz  not null default now(),
  uploaded_by     text         not null,
  file_name       text         not null,
  file_size_bytes bigint       not null,
  map             text         not null,
  total_rounds    integer      not null,
  fingerprint     text         not null unique,
  record          bytea        not null
);

create index if not exists matches_played_at_idx on matches (played_at desc);
create index if not exists matches_map_idx on matches (map);

create table if not exists premier_scoreboards (
  id uuid primary key,
  played_at timestamptz not null,
  record bytea not null
);

create table if not exists app_config (
  id                integer primary key default 1 check (id = 1),
  team_name         text    not null default 'Nosso time',
  tracked_steam_ids text[]  not null default '{}',
  hidden_steam_ids  text[]  not null default '{}',
  aliases           jsonb   not null default '{}'::jsonb,
  display_names     jsonb   not null default '{}'::jsonb
);

insert into app_config (id) values (1) on conflict (id) do nothing;

create table if not exists match_heatmaps (
  match_id uuid  not null references matches (id) on delete cascade,
  steam_id text  not null,
  heatmap  bytea not null,
  primary key (match_id, steam_id)
);

create index if not exists match_heatmaps_steam_id_idx on match_heatmaps (steam_id);

create table if not exists steam_users (
  steam_id        text primary key,
  persona         text        not null default '',
  avatar          text        not null default '',
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create table if not exists steam_profiles (
  steam_id   text primary key,
  persona    text        not null default '',
  avatar     text        not null default '',
  fetched_at timestamptz not null default now()
);

create table if not exists ingest_lock (
  id           integer primary key default 1 check (id = 1),
  token        text,
  locked_until timestamptz not null default now() - interval '1 second'
);

insert into ingest_lock (id) values (1) on conflict (id) do nothing;

alter table matches add column if not exists file_hash text;
create index if not exists matches_file_hash_idx on matches (file_hash);
alter table app_config add column if not exists revision bigint not null default 1;

create table if not exists share_codes (
  code     text        primary key,
  added_by text        not null,
  added_at timestamptz not null default now(),
  status   text        not null default 'pending',
  match_id uuid
);

alter table matches        enable row level security;
alter table premier_scoreboards enable row level security;
alter table match_heatmaps enable row level security;
alter table app_config     enable row level security;
alter table steam_users    enable row level security;
alter table steam_profiles enable row level security;
alter table ingest_lock    enable row level security;
alter table share_codes    enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke usage on schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;
