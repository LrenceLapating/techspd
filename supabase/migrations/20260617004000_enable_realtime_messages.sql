-- Enable Supabase Realtime events for live inbox message inserts.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end;
$$;
