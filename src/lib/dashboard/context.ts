import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type ProfileWithCompany = {
  company_id: string | null;
  email: string | null;
  companies: { name: string | null } | { name: string | null }[] | null;
};

export type DashboardContext = {
  companyId?: string;
  companyName?: string;
  counts: DashboardCounts;
  email?: string;
  isConfigured: boolean;
};

export type DashboardCounts = {
  conversations: number;
  customers: number;
  messages: number;
  conversions: number;
};

const emptyCounts: DashboardCounts = {
  conversations: 0,
  customers: 0,
  messages: 0,
  conversions: 0,
};

async function safeExactCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
) {
  const { count, error } = await query;

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getDashboardContext(): Promise<DashboardContext> {
  if (!hasSupabaseConfig()) {
    return {
      counts: emptyCounts,
      isConfigured: false,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({
    data: {
      user: null,
    },
  }));

  if (!user) {
    redirect("/auth/login");
  }

  const { data, error: profileError } = await supabase
    .from("users")
    .select("company_id, email, companies(name)")
    .eq("id", user.id)
    .single();

  const profile = profileError ? null : (data as ProfileWithCompany | null);
  const companyName = Array.isArray(profile?.companies)
    ? profile?.companies[0]?.name
    : profile?.companies?.name;

  const [conversations, customers, messages, conversions] = await Promise.all([
    safeExactCount(
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true }),
    ),
    safeExactCount(
      supabase.from("customers").select("id", { count: "exact", head: true }),
    ),
    safeExactCount(
      supabase.from("messages").select("id", { count: "exact", head: true }),
    ),
    safeExactCount(
      supabase.from("conversions").select("id", { count: "exact", head: true }),
    ),
  ]);

  return {
    companyId: profile?.company_id ?? undefined,
    companyName: companyName ?? undefined,
    counts: {
      conversations,
      customers,
      messages,
      conversions,
    },
    email: profile?.email ?? user.email ?? undefined,
    isConfigured: true,
  };
}
