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
  record          jsonb        not null
);

create index if not exists matches_played_at_idx on matches (played_at desc);
create index if not exists matches_map_idx on matches (map);

create table if not exists app_config (
  id                integer primary key default 1 check (id = 1),
  team_name         text    not null default 'Nosso time',
  tracked_steam_ids text[]  not null default '{}',
  hidden_steam_ids  text[]  not null default '{}',
  aliases           jsonb   not null default '{}'::jsonb,
  display_names     jsonb   not null default '{}'::jsonb
);

insert into app_config (id) values (1) on conflict (id) do nothing;

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
