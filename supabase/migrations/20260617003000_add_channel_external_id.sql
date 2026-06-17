alter table public.channels
  add column if not exists external_id text;

create unique index if not exists channels_company_id_external_id_idx
on public.channels(company_id, external_id)
where external_id is not null;
