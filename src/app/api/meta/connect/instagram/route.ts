import { NextResponse } from "next/server";
import {
  buildMetaAuthorizationUrl,
  createMetaState,
  getAuthenticatedMetaCompany,
} from "@/lib/meta/integration";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await getAuthenticatedMetaCompany(supabase);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const state = createMetaState({
    companyId: auth.companyId,
    provider: "instagram",
    userId: auth.userId,
  });
  try {
    const authUrl = buildMetaAuthorizationUrl({
      origin: new URL(request.url).origin,
      provider: "instagram",
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to start Instagram OAuth.",
      provider: "instagram",
      requiredEnv: [
        "META_APP_ID",
        "META_APP_SECRET",
        "META_REDIRECT_URI",
        "META_INSTAGRAM_SCOPES",
      ],
    }, { status: 500 });
  }
}
