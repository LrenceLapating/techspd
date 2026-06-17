alter table public.conversations
add column if not exists last_message text;
