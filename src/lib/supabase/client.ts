import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/env";

export function createClient() {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client must only be created in the browser.");
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
  );
}
