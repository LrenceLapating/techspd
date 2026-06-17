import { NextResponse } from "next/server";
import {
  createMetaOAuthSession,
  exchangeMetaCodeForUserToken,
  fetchMetaPages,
  getAuthenticatedMetaCompany,
  parseMetaState,
  providerFromValue,
} from "@/lib/meta/integration";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        error: "Meta OAuth was cancelled or failed.",
        metaError: error,
        errorDescription: url.searchParams.get("error_description"),
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const auth = await getAuthenticatedMetaCompany(supabase);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsedState = parseMetaState(url.searchParams.get("state"));
  const provider =
    parsedState?.provider ?? providerFromValue(url.searchParams.get("provider"));
  const code = url.searchParams.get("code");

  if (!provider) {
    return NextResponse.json(
      { error: "Missing Meta provider in callback state or query." },
      { status: 400 },
    );
  }

  if (parsedState && parsedState.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Meta callback state does not match this company." },
      { status: 403 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing Meta OAuth code.", provider },
      { status: 400 },
    );
  }

  try {
    const userAccessToken = await exchangeMetaCodeForUserToken({
      code,
      origin: url.origin,
    });
    const pages = await fetchMetaPages(userAccessToken);
    const selectablePages =
      provider === "instagram"
        ? pages.filter((page) => page.instagramBusinessAccount)
        : pages;

    if (selectablePages.length === 0) {
      return NextResponse.json(
        {
          error:
            provider === "instagram"
              ? "No Facebook Pages with linked Instagram Professional Accounts were returned by Meta."
              : "No Facebook Pages were returned by Meta.",
          provider,
        },
        { status: 404 },
      );
    }

    const sessionId = await createMetaOAuthSession({
      companyId: auth.companyId,
      pages: selectablePages,
      provider,
      userAccessToken,
    });
    const selectUrl = new URL("/settings/meta/select", url.origin);

    selectUrl.searchParams.set("session", sessionId);

    return NextResponse.redirect(selectUrl);
  } catch (metaError) {
    return NextResponse.json(
      {
        error:
          metaError instanceof Error
            ? metaError.message
            : "Meta OAuth callback failed.",
        provider,
      },
      { status: 500 },
    );
  }
}
