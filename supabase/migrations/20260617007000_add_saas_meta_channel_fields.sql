alter table public.channels
  add column if not exists platform text,
  add column if not exists channel_id text,
  add column if not exists channel_name text,
  add column if not exists access_token text,
  add column if not exists connected_at timestamptz,
  add column if not exists is_connected boolean not null default false;

create unique index if not exists channels_company_id_platform_channel_id_idx
on public.channels(company_id, platform, channel_id)
where platform is not null and channel_id is not null;

create index if not exists channels_company_id_platform_connected_idx
on public.channels(company_id, platform, is_connected);
