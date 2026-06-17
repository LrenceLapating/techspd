create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

create type public.channel_type as enum (
  'email',
  'sms',
  'whatsapp',
  'web_chat',
  'phone',
  'social',
  'api'
);

create type public.conversation_status as enum (
  'open',
  'pending',
  'resolved',
  'archived'
);

create type public.message_sender_type as enum (
  'customer',
  'agent',
  'system'
);

create type public.conversion_status as enum (
  'pending',
  'won',
  'lost',
  'refunded'
);

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email),
  unique (id, company_id)
);

create table public.channels (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type public.channel_type not null,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_id text,
  name text not null check (char_length(trim(name)) > 0),
  email text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, external_id),
  unique (id, company_id)
);

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  channel_id uuid,
  assigned_user_id uuid,
  subject text,
  status public.conversation_status not null default 'open',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete cascade,
  foreign key (channel_id, company_id)
    references public.channels(id, company_id),
  foreign key (assigned_user_id, company_id)
    references public.users(id, company_id)
);

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null,
  customer_id uuid,
  sender_user_id uuid,
  sender_type public.message_sender_type not null,
  body text not null check (char_length(trim(body)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (conversation_id, company_id)
    references public.conversations(id, company_id)
    on delete cascade,
  foreign key (customer_id, company_id)
    references public.customers(id, company_id),
  foreign key (sender_user_id, company_id)
    references public.users(id, company_id)
);

create table public.customer_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  author_user_id uuid,
  note text not null check (char_length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete cascade,
  foreign key (author_user_id, company_id)
    references public.users(id, company_id)
);

create table public.customer_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#2457d6',
  created_at timestamptz not null default now(),
  unique (company_id, customer_id, name),
  unique (id, company_id),
  foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete cascade
);

create table public.conversions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  conversation_id uuid,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status public.conversion_status not null default 'pending',
  converted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete cascade,
  foreign key (conversation_id, company_id)
    references public.conversations(id, company_id)
);

create index companies_created_at_idx on public.companies(created_at desc);
create index users_company_id_idx on public.users(company_id);
create index channels_company_id_type_idx on public.channels(company_id, type);
create index customers_company_id_created_at_idx on public.customers(company_id, created_at desc);
create index customers_company_id_email_idx on public.customers(company_id, email);
create index conversations_company_id_status_idx on public.conversations(company_id, status);
create index conversations_company_id_customer_id_idx on public.conversations(company_id, customer_id);
create index messages_company_id_conversation_id_sent_at_idx on public.messages(company_id, conversation_id, sent_at desc);
create index customer_notes_company_id_customer_id_idx on public.customer_notes(company_id, customer_id);
create index customer_tags_company_id_customer_id_idx on public.customer_tags(company_id, customer_id);
create index conversions_company_id_customer_id_idx on public.conversions(company_id, customer_id);
create index conversions_company_id_status_idx on public.conversions(company_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger channels_set_updated_at
before update on public.channels
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger customer_notes_set_updated_at
before update on public.customer_notes
for each row execute function public.set_updated_at();

create trigger conversions_set_updated_at
before update on public.conversions
for each row execute function public.set_updated_at();

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.company_id
  from public.users as u
  where u.id = (select auth.uid())
  limit 1
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  company_name text;
begin
  company_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');

  if company_name is null then
    company_name := split_part(new.email, '@', 1) || '''s Company';
  end if;

  insert into public.companies (name)
  values (company_name)
  returning id into new_company_id;

  insert into public.users (id, company_id, email, full_name, role)
  values (
    new.id,
    new_company_id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'owner'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.channels enable row level security;
alter table public.customers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.customer_notes enable row level security;
alter table public.customer_tags enable row level security;
alter table public.conversions enable row level security;

create policy "Company members can view their company"
on public.companies
for select
to authenticated
using (id = (select private.current_company_id()));

create policy "Company members can update their company"
on public.companies
for update
to authenticated
using (id = (select private.current_company_id()))
with check (id = (select private.current_company_id()));

create policy "Users can view their company users"
on public.users
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Users can update their own profile"
on public.users
for update
to authenticated
using (
  id = (select auth.uid())
  and company_id = (select private.current_company_id())
)
with check (
  id = (select auth.uid())
  and company_id = (select private.current_company_id())
);

create policy "Company members can read channels"
on public.channels
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create channels"
on public.channels
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update channels"
on public.channels
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete channels"
on public.channels
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read customers"
on public.customers
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create customers"
on public.customers
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update customers"
on public.customers
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete customers"
on public.customers
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read conversations"
on public.conversations
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create conversations"
on public.conversations
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update conversations"
on public.conversations
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete conversations"
on public.conversations
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read messages"
on public.messages
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create messages"
on public.messages
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update messages"
on public.messages
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete messages"
on public.messages
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read customer notes"
on public.customer_notes
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create customer notes"
on public.customer_notes
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update customer notes"
on public.customer_notes
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete customer notes"
on public.customer_notes
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read customer tags"
on public.customer_tags
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create customer tags"
on public.customer_tags
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update customer tags"
on public.customer_tags
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete customer tags"
on public.customer_tags
for delete
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can read conversions"
on public.conversions
for select
to authenticated
using (company_id = (select private.current_company_id()));

create policy "Company members can create conversions"
on public.conversions
for insert
to authenticated
with check (company_id = (select private.current_company_id()));

create policy "Company members can update conversions"
on public.conversions
for update
to authenticated
using (company_id = (select private.current_company_id()))
with check (company_id = (select private.current_company_id()));

create policy "Company members can delete conversions"
on public.conversions
for delete
to authenticated
using (company_id = (select private.current_company_id()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.companies,
  public.users,
  public.channels,
  public.customers,
  public.conversations,
  public.messages,
  public.customer_notes,
  public.customer_tags,
  public.conversions
to authenticated;

revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_company_id() to authenticated;
revoke all on function private.handle_new_auth_user() from anon, authenticated;
