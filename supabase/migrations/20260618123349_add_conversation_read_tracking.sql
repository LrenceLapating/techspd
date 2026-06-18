alter table public.conversations
  add column if not exists unread_count integer not null default 0
    check (unread_count >= 0),
  add column if not exists last_read_at timestamptz;

create or replace function private.increment_conversation_unread_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_type = 'customer' then
    update public.conversations
    set unread_count = unread_count + 1
    where id = new.conversation_id
      and company_id = new.company_id;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_increment_conversation_unread on public.messages;
create trigger messages_increment_conversation_unread
after insert on public.messages
for each row execute function private.increment_conversation_unread_count();

revoke all on function private.increment_conversation_unread_count() from anon, authenticated;
