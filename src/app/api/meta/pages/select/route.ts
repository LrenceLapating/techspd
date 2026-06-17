import { NextResponse } from "next/server";
import {
  getAuthenticatedMetaCompany,
  getMetaOAuthSession,
  saveSelectedMetaPage,
} from "@/lib/meta/integration";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await getAuthenticatedMetaCompany(supabase);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const sessionId = stringField(formData.get("session_id"));
  const pageId = stringField(formData.get("page_id"));

  if (!sessionId || !pageId) {
    return NextResponse.json(
      { error: "Missing Meta OAuth session or page selection." },
      { status: 400 },
    );
  }

  const session = await getMetaOAuthSession({
    companyId: auth.companyId,
    sessionId,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Meta OAuth session expired or does not belong to this company." },
      { status: 404 },
    );
  }

  try {
    await saveSelectedMetaPage({
      companyId: auth.companyId,
      pageId,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save selected Meta page.",
      },
      { status: 500 },
    );
  }

  const settingsUrl = new URL("/settings", request.url);

  settingsUrl.searchParams.set("meta_connected", session.provider);

  return NextResponse.redirect(settingsUrl, { status: 303 });
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : null;
}
