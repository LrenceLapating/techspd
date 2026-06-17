create table if not exists private.meta_oauth_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('facebook', 'instagram')),
  user_access_token text not null,
  pages jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists meta_oauth_sessions_company_id_idx
on private.meta_oauth_sessions(company_id, expires_at desc);

alter table private.meta_oauth_sessions enable row level security;

revoke all on private.meta_oauth_sessions from anon, authenticated;
revoke all on private.meta_oauth_sessions from public;
