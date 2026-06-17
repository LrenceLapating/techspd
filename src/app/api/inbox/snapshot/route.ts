import { NextResponse } from "next/server";
import { getInboxSnapshot } from "@/lib/inbox/data";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  company_id: string | null;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profileError
    ? null
    : ((profile as ProfileRow | null)?.company_id ?? null);

  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const selectedConversationId = url.searchParams.get("conversationId");
  const snapshot = await getInboxSnapshot({
    companyId,
    selectedConversationId,
    supabaseClient: supabase,
  });

  return NextResponse.json(snapshot);
}
