import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type MetaProvider = "facebook" | "instagram";

export type MetaIntegrationInput = {
  accessToken: string | null;
  pageAccessToken: string | null;
  pageId: string | null;
  pageName: string | null;
  provider: MetaProvider;
  instagramId?: string | null;
  instagramUsername?: string | null;
};

export type MetaPageAccount = {
  accessToken: string;
  id: string;
  instagramBusinessAccount: {
    id: string;
    username: string | null;
  } | null;
  name: string;
};

export type MetaOAuthSession = {
  companyId: string;
  id: string;
  pages: MetaPageAccount[];
  provider: MetaProvider;
  userAccessToken: string;
};

type ProfileRow = {
  company_id: string | null;
};

type MetaTokenResponse = {
  access_token?: string;
  error?: {
    message?: string;
  };
  expires_in?: number;
  token_type?: string;
};

type MetaAccountsResponse = {
  data?: Array<{
    access_token?: string;
    id?: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
    };
    name?: string;
  }>;
  error?: {
    message?: string;
  };
};

export async function getAuthenticatedMetaCompany(supabase: SupabaseClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const { data, error: profileError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const companyId = profileError
    ? null
    : ((data as ProfileRow | null)?.company_id ?? null);

  if (!companyId) {
    return { error: "Company not found", status: 404 as const };
  }

  return {
    companyId,
    userId: user.id,
  };
}

export function buildMetaAuthorizationUrl({
  origin,
  provider,
  state,
}: {
  origin: string;
  provider: MetaProvider;
  state: string;
}) {
  const appId = readMetaEnv("META_APP_ID");
  const appSecret = readMetaEnv("META_APP_SECRET");
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";

  if (!appId || !appSecret) {
    throw new Error("Missing META_APP_ID or META_APP_SECRET.");
  }

  const redirectUri = getMetaRedirectUri(origin);
  const scopes =
    provider === "facebook"
      ? process.env.META_FACEBOOK_SCOPES
      : process.env.META_INSTAGRAM_SCOPES;
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (scopes) {
    url.searchParams.set("scope", scopes);
  }

  return url;
}

export function getMetaRedirectUri(origin: string) {
  return readMetaEnv("META_REDIRECT_URI") ?? `${origin}/api/meta/callback`;
}

export function createMetaState({
  companyId,
  provider,
  userId,
}: {
  companyId: string;
  provider: MetaProvider;
  userId: string;
}) {
  return Buffer.from(
    JSON.stringify({
      companyId,
      provider,
      userId,
    }),
    "utf8",
  ).toString("base64url");
}

export function parseMetaState(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<{
      companyId: string;
      provider: MetaProvider;
      userId: string;
    }>;

    if (
      parsed.provider !== "facebook" &&
      parsed.provider !== "instagram"
    ) {
      return null;
    }

    if (!parsed.companyId || !parsed.userId) {
      return null;
    }

    return {
      companyId: parsed.companyId,
      provider: parsed.provider,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function providerFromValue(value: string | null): MetaProvider | null {
  if (value === "facebook" || value === "instagram") {
    return value;
  }

  return null;
}

export async function exchangeMetaCodeForUserToken({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
  const appId = requiredMetaEnv("META_APP_ID");
  const appSecret = requiredMetaEnv("META_APP_SECRET");
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const url = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", getMetaRedirectUri(origin));

  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as MetaTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error?.message ?? "Unable to exchange Meta OAuth code.",
    );
  }

  return exchangeForLongLivedMetaToken(payload.access_token);
}

export async function fetchMetaPages(accessToken: string) {
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);

  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as MetaAccountsResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Unable to fetch Meta pages.");
  }

  return (payload.data ?? [])
    .filter((page) => page.id && page.name && page.access_token)
    .map((page) => ({
      accessToken: page.access_token as string,
      id: page.id as string,
      instagramBusinessAccount: page.instagram_business_account?.id
        ? {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username ?? null,
          }
        : null,
      name: page.name as string,
    }));
}

export async function createMetaOAuthSession({
  companyId,
  pages,
  provider,
  userAccessToken,
}: {
  companyId: string;
  pages: MetaPageAccount[];
  provider: MetaProvider;
  userAccessToken: string;
}) {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .schema("private")
    .from("meta_oauth_sessions")
    .insert({
      company_id: companyId,
      expires_at: expiresAt,
      pages,
      provider,
      user_access_token: userAccessToken,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function getMetaOAuthSession({
  companyId,
  sessionId,
}: {
  companyId: string;
  sessionId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("private")
    .from("meta_oauth_sessions")
    .select("id, company_id, provider, pages, user_access_token")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return {
    companyId: data.company_id,
    id: data.id,
    pages: data.pages,
    provider: data.provider,
    userAccessToken: data.user_access_token,
  } as MetaOAuthSession;
}

export async function saveSelectedMetaPage({
  companyId,
  pageId,
  session,
}: {
  companyId: string;
  pageId: string;
  session: MetaOAuthSession;
}) {
  const page = session.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    throw new Error("Selected Meta page was not found in this OAuth session.");
  }

  const result = await saveMetaIntegration({
    companyId,
    input: {
      accessToken: session.userAccessToken,
      instagramId: page.instagramBusinessAccount?.id ?? null,
      instagramUsername: page.instagramBusinessAccount?.username ?? null,
      pageAccessToken: page.accessToken,
      pageId: page.id,
      pageName: page.name,
      provider: session.provider,
    },
  });

  await deleteMetaOAuthSession(session.id);

  return {
    ...result,
    pageId: page.id,
    pageName: page.name,
  };
}

export async function saveMetaIntegration({
  companyId,
  input,
}: {
  companyId: string;
  input: MetaIntegrationInput;
}) {
  const admin = createAdminClient();
  const connectedAt = new Date().toISOString();
  const savedChannels: Array<"facebook" | "instagram"> = [];

  const { data: integration, error: integrationError } = await admin
    .schema("private")
    .from("meta_integrations")
    .upsert(
      {
        access_token: input.accessToken,
        company_id: companyId,
        instagram_id: input.instagramId ?? null,
        instagram_username: input.instagramUsername ?? null,
        page_access_token: input.pageAccessToken,
        page_id: input.pageId,
        page_name: input.pageName,
        provider: input.provider,
      },
      {
        onConflict: "company_id,provider",
      },
    )
    .select("id, provider")
    .single();

  if (integrationError) {
    throw new Error(integrationError.message);
  }

  const { error: facebookChannelError } = await admin.from("channels").upsert(
    {
      access_token: input.pageAccessToken,
      channel_id: input.pageId,
      channel_name: input.pageName,
      company_id: companyId,
      connected_at: connectedAt,
      external_id: input.pageId,
      is_active: true,
      is_connected: true,
      name: "Facebook",
      platform: "facebook",
      settings: {
        connected_at: connectedAt,
        instagram_id: input.instagramId,
        instagram_username: input.instagramUsername,
        meta_integration_id: integration.id,
        page_id: input.pageId,
        page_name: input.pageName,
        provider: input.provider,
      },
      type: "social",
    },
    {
      onConflict: "company_id,platform,channel_id",
    },
  );

  if (facebookChannelError) {
    throw new Error(facebookChannelError.message);
  }

  savedChannels.push("facebook");

  if (input.instagramId) {
    const { error: instagramChannelError } = await admin.from("channels").upsert(
      {
        access_token: input.pageAccessToken,
        channel_id: input.instagramId,
        channel_name: input.instagramUsername ?? "Instagram",
        company_id: companyId,
        connected_at: connectedAt,
        external_id: input.instagramId,
        is_active: true,
        is_connected: true,
        name: "Instagram",
        platform: "instagram",
        settings: {
          connected_at: connectedAt,
          instagram_id: input.instagramId,
          instagram_username: input.instagramUsername,
          linked_facebook_page_id: input.pageId,
          linked_facebook_page_name: input.pageName,
          meta_integration_id: integration.id,
          provider: "instagram",
        },
        type: "social",
      },
      {
        onConflict: "company_id,platform,channel_id",
      },
    );

    if (instagramChannelError) {
      throw new Error(instagramChannelError.message);
    }

    savedChannels.push("instagram");
  }

  return {
    channels: savedChannels,
    integrationId: integration.id as string,
    provider: input.provider,
  };
}

function readMetaEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value : null;
}

async function exchangeForLongLivedMetaToken(accessToken: string) {
  const appId = requiredMetaEnv("META_APP_ID");
  const appSecret = requiredMetaEnv("META_APP_SECRET");
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const url = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", accessToken);
  url.searchParams.set("grant_type", "fb_exchange_token");

  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as MetaTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error?.message ?? "Unable to exchange long-lived Meta token.",
    );
  }

  return payload.access_token;
}

async function deleteMetaOAuthSession(sessionId: string) {
  const admin = createAdminClient();
  await admin
    .schema("private")
    .from("meta_oauth_sessions")
    .delete()
    .eq("id", sessionId);
}

function requiredMetaEnv(key: "META_APP_ID" | "META_APP_SECRET") {
  const value = readMetaEnv(key);

  if (!value) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}
