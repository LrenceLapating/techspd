import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase/env";

export function createAdminClient() {
  const { supabaseServiceRoleKey, supabaseUrl } = getSupabaseAdminConfig();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
