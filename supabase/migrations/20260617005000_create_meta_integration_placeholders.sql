create table if not exists private.meta_integrations (
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
on private.meta_integrations(company_id, provider);

drop trigger if exists meta_integrations_set_updated_at
on private.meta_integrations;

create trigger meta_integrations_set_updated_at
before update on private.meta_integrations
for each row execute function public.set_updated_at();

alter table private.meta_integrations enable row level security;

revoke all on private.meta_integrations from anon, authenticated;
revoke all on private.meta_integrations from public;
