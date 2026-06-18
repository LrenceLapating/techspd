-- Enable Supabase Realtime events for live inbox conversation inserts/updates.
do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end;
$$;
