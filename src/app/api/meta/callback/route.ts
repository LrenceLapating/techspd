import { NextResponse } from "next/server";
import {
  createMetaOAuthSession,
  debugMetaToken,
  exchangeMetaCodeForUserToken,
  extractGranularPageTargetIds,
  fetchMetaAccountsRaw,
  fetchMetaPagesByTargetIds,
  getAuthenticatedMetaCompany,
  getRequestedMetaScopes,
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
  const debugMode =
    url.searchParams.get("debug") === "1" ||
    url.searchParams.get("debug") === "true";

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
    const requestedScopes = getRequestedMetaScopes(provider);
    const [accountsResult, tokenDebugInfo] = await Promise.all([
      fetchMetaAccountsRaw(userAccessToken),
      debugMetaToken(userAccessToken),
    ]);
    const granularTargetIds =
      accountsResult.pages.length === 0
        ? extractGranularPageTargetIds(tokenDebugInfo)
        : [];
    const directPageFetchResults =
      granularTargetIds.length > 0
        ? await fetchMetaPagesByTargetIds({
            accessToken: userAccessToken,
            targetIds: granularTargetIds,
          })
        : { pages: [], results: [] };
    const pages =
      accountsResult.pages.length > 0
        ? accountsResult.pages
        : directPageFetchResults.pages;
    const selectablePages =
      provider === "instagram"
        ? pages.filter((page) => page.instagramBusinessAccount)
        : pages;

    if (debugMode) {
      return NextResponse.json({
        debug: true,
        graph_request: {
          fields: "id,name,access_token,instagram_business_account{id,username}",
          method: "GET",
          url: "https://graph.facebook.com/v19.0/me/accounts",
        },
        accountsResponse: accountsResult.payload,
        directPageFetchResults: directPageFetchResults.results,
        granularTargetIds,
        meta_error:
          accountsResult.payload.error ?? tokenDebugInfo.error ?? null,
        provider,
        requested_scopes: requestedScopes,
        selectable_pages_count: selectablePages.length,
        token_debug: tokenDebugInfo,
        raw_accounts_response: accountsResult.payload,
      });
    }

    if (!accountsResult.response.ok) {
      return NextResponse.json(
        {
          error:
            accountsResult.payload.error?.message ??
            "Unable to fetch Meta pages.",
          metaError: accountsResult.payload.error ?? null,
          provider,
          directPageFetchResults: directPageFetchResults.results,
          granularTargetIds,
          rawAccountsResponse: accountsResult.payload,
          requestedScopes,
          tokenDebug: tokenDebugInfo,
        },
        { status: accountsResult.response.status },
      );
    }

    if (selectablePages.length === 0) {
      return NextResponse.json(
        {
          error:
            provider === "instagram"
              ? "No Facebook Pages with linked Instagram Professional Accounts were returned by Meta."
              : "No Facebook Pages were returned by Meta.",
          metaError: accountsResult.payload.error ?? null,
          provider,
          directPageFetchResults: directPageFetchResults.results,
          granularTargetIds,
          rawAccountsResponse: accountsResult.payload,
          requestedScopes,
          tokenDebug: tokenDebugInfo,
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
    const typedMetaError = metaError as Error & {
      metaError?: unknown;
      status?: number;
    };

    return NextResponse.json(
      {
        error:
          metaError instanceof Error
            ? metaError.message
            : "Meta OAuth callback failed.",
        metaError: typedMetaError.metaError ?? null,
        provider,
      },
      { status: typedMetaError.status ?? 500 },
    );
  }
}
