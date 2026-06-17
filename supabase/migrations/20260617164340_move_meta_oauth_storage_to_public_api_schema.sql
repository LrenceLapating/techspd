create table if not exists public.meta_oauth_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('facebook', 'instagram')),
  user_access_token text not null,
  pages jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists meta_oauth_sessions_company_id_idx
on public.meta_oauth_sessions(company_id, expires_at desc);

create table if not exists public.meta_integrations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('facebook', 'instagram')),
  page_id text,
  page_name text,
  page_access_token text,
  instagram_id text,
  instagram_username text,
  access_token text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists meta_integrations_company_id_provider_idx
on public.meta_integrations(company_id, provider);

drop trigger if exists meta_integrations_set_updated_at
on public.meta_integrations;

create trigger meta_integrations_set_updated_at
before update on public.meta_integrations
for each row execute function public.set_updated_at();

insert into public.meta_oauth_sessions (
  id,
  company_id,
  provider,
  user_access_token,
  pages,
  expires_at,
  created_at
)
select
  id,
  company_id,
  provider,
  user_access_token,
  pages,
  expires_at,
  created_at
from private.meta_oauth_sessions
on conflict (id) do nothing;

insert into public.meta_integrations (
  id,
  company_id,
  provider,
  page_id,
  page_name,
  page_access_token,
  instagram_id,
  instagram_username,
  access_token,
  metadata,
  created_at,
  updated_at
)
select
  id,
  company_id,
  provider,
  page_id,
  page_name,
  page_access_token,
  instagram_id,
  instagram_username,
  access_token,
  metadata,
  created_at,
  updated_at
from private.meta_integrations
on conflict (company_id, provider) do update set
  page_id = excluded.page_id,
  page_name = excluded.page_name,
  page_access_token = excluded.page_access_token,
  instagram_id = excluded.instagram_id,
  instagram_username = excluded.instagram_username,
  access_token = excluded.access_token,
  metadata = excluded.metadata,
  updated_at = excluded.updated_at;

alter table public.meta_oauth_sessions enable row level security;
alter table public.meta_integrations enable row level security;

revoke all on public.meta_oauth_sessions from anon, authenticated;
revoke all on public.meta_integrations from anon, authenticated;
