do $$
begin
  if not exists (select 1 from pg_type where typname = 'customer_platform') then
    create type public.customer_platform as enum (
      'facebook',
      'instagram',
      'tiktok',
      'unknown'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
    create type public.lead_stage as enum (
      'new',
      'interested',
      'follow_up',
      'converted',
      'lost'
    );
  end if;
end;
$$;

alter table public.customers
  add column if not exists platform public.customer_platform not null default 'unknown',
  add column if not exists ai_enabled boolean not null default true,
  add column if not exists lead_stage public.lead_stage not null default 'new',
  add column if not exists converted boolean not null default false,
  add column if not exists converted_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists location text;

create index if not exists customers_company_id_platform_idx
on public.customers(company_id, platform);

create index if not exists customers_company_id_lead_stage_idx
on public.customers(company_id, lead_stage);

create index if not exists customers_company_id_converted_idx
on public.customers(company_id, converted);

create index if not exists customers_company_id_last_activity_idx
on public.customers(company_id, last_activity_at desc nulls last);

create or replace function private.normalize_customer_conversion_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.lead_stage = 'converted' then
    new.converted := true;
  end if;

  if new.converted and new.converted_at is null then
    new.converted_at := now();
  end if;

  if not new.converted then
    new.converted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_normalize_conversion_fields on public.customers;
create trigger customers_normalize_conversion_fields
before insert or update of lead_stage, converted, converted_at
on public.customers
for each row execute function private.normalize_customer_conversion_fields();

create or replace function private.create_conversion_when_customer_converted()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  existing_conversion_id uuid;
begin
  if not new.converted then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.converted is true
    and old.lead_stage = new.lead_stage
    and old.converted_at is not distinct from new.converted_at then
    return new;
  end if;

  select id into existing_conversion_id
  from public.conversions
  where company_id = new.company_id
    and customer_id = new.id
    and metadata ->> 'source' = 'customer_marked_converted'
  order by created_at asc
  limit 1;

  if existing_conversion_id is null then
    insert into public.conversions (
      company_id,
      customer_id,
      status,
      converted_at,
      metadata
    )
    values (
      new.company_id,
      new.id,
      'won',
      coalesce(new.converted_at, now()),
      jsonb_build_object(
        'source', 'customer_marked_converted',
        'customer_name', new.name,
        'notes', coalesce(new.metadata ->> 'conversion_notes', '')
      )
    );
  else
    update public.conversions
    set
      status = 'won',
      converted_at = coalesce(new.converted_at, converted_at, now()),
      metadata = metadata
        || jsonb_build_object(
          'customer_name', new.name,
          'notes', coalesce(new.metadata ->> 'conversion_notes', '')
        )
    where id = existing_conversion_id;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_create_conversion_record on public.customers;
create trigger customers_create_conversion_record
after insert or update of lead_stage, converted, converted_at, metadata
on public.customers
for each row execute function private.create_conversion_when_customer_converted();
