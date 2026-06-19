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

type SupabaseStorageDiagnostic = {
  error: unknown;
  operation: string;
  query: string;
  schema: string;
  table: string;
};

type MetaTokenResponse = {
  access_token?: string;
  error?: {
    code?: number;
    message?: string;
    type?: string;
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
    code?: number;
    message?: string;
    type?: string;
  };
};

type MetaPageRaw = NonNullable<MetaAccountsResponse["data"]>[number];

type MetaSubscribedAppsResponse = {
  error?: {
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    message?: string;
    type?: string;
  };
  success?: boolean;
};

type ChannelSettings = Record<string, unknown>;

type FacebookChannelRow = {
  access_token: string | null;
  channel_id: string | null;
  id: string;
  settings: ChannelSettings | null;
};

type MetaPageDirectFetchResult = {
  ok: boolean;
  page: MetaPageAccount | null;
  pageId: string;
  payload: MetaAccountsResponse | MetaPageRaw;
  status: number;
};

type MetaDebugTokenResponse = {
  data?: {
    app_id?: string;
    application?: string;
    data_access_expires_at?: number;
    expires_at?: number;
    granular_scopes?: Array<{
      scope?: string;
      target_ids?: string[];
    }>;
    is_valid?: boolean;
    scopes?: string[];
    type?: string;
    user_id?: string;
  };
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
};

const pageRelatedScopes = new Set([
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_engagement",
  "pages_read_user_content",
]);

const metaStorageSchema = "public";
const metaOAuthSessionsTable = "meta_oauth_sessions";
const metaIntegrationsTable = "meta_integrations";
const subscribedAppsGraphVersion = "v19.0";
const facebookMessengerSubscribedFields =
  "messages,messaging_postbacks,message_echoes";
const instagramSubscribedFields = "messages,message_echoes,message_reads";

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

export function getRequestedMetaScopes(provider: MetaProvider) {
  const scopes =
    provider === "facebook"
      ? process.env.META_FACEBOOK_SCOPES
      : process.env.META_INSTAGRAM_SCOPES;

  return (scopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
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
    throw metaApiError(
      payload.error?.message ?? "Unable to exchange Meta OAuth code.",
      payload.error,
      response.status,
    );
  }

  return exchangeForLongLivedMetaToken(payload.access_token);
}

export async function fetchMetaPages(accessToken: string) {
  const { payload, response } = await fetchMetaAccountsRaw(accessToken);

  if (!response.ok) {
    throw metaApiError(
      payload.error?.message ?? "Unable to fetch Meta pages.",
      payload.error,
      response.status,
    );
  }

  return mapMetaPages(payload);
}

export async function fetchMetaAccountsRaw(accessToken: string) {
  const url = new URL("https://graph.facebook.com/v19.0/me/accounts");

  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as MetaAccountsResponse;

  return {
    pages: response.ok ? mapMetaPages(payload) : [],
    payload,
    response,
  };
}

export function extractGranularPageTargetIds(
  tokenDebugInfo: MetaDebugTokenResponse,
) {
  const targetIds = new Set<string>();

  for (const granularScope of tokenDebugInfo.data?.granular_scopes ?? []) {
    if (!granularScope.scope || !pageRelatedScopes.has(granularScope.scope)) {
      continue;
    }

    for (const targetId of granularScope.target_ids ?? []) {
      if (targetId.trim()) {
        targetIds.add(targetId.trim());
      }
    }
  }

  return [...targetIds];
}

export async function fetchMetaPagesByTargetIds({
  accessToken,
  targetIds,
}: {
  accessToken: string;
  targetIds: string[];
}) {
  const results = await Promise.all(
    targetIds.map((pageId) => fetchMetaPageById({ accessToken, pageId })),
  );

  return {
    pages: results.flatMap((result) => (result.page ? [result.page] : [])),
    results,
  };
}

async function fetchMetaPageById({
  accessToken,
  pageId,
}: {
  accessToken: string;
  pageId: string;
}): Promise<MetaPageDirectFetchResult> {
  const url = new URL(`https://graph.facebook.com/v19.0/${pageId}`);

  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | MetaAccountsResponse
    | MetaPageRaw;

  return {
    ok: response.ok,
    page: response.ok ? mapMetaPage(payload) : null,
    pageId,
    payload,
    status: response.status,
  };
}

export async function debugMetaToken(accessToken: string) {
  const appId = readMetaEnv("META_APP_ID");
  const appSecret = readMetaEnv("META_APP_SECRET");

  if (!appId || !appSecret) {
    return {
      error: {
        message: "Missing META_APP_ID or META_APP_SECRET.",
      },
    } satisfies MetaDebugTokenResponse;
  }

  const url = new URL("https://graph.facebook.com/v19.0/debug_token");

  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const response = await fetch(url, {
    cache: "no-store",
  });

  return (await response.json()) as MetaDebugTokenResponse;
}

function mapMetaPages(payload: MetaAccountsResponse) {
  return (payload.data ?? [])
    .filter((page) => page.id && page.name && page.access_token)
    .map(mapMetaPage)
    .filter((page): page is MetaPageAccount => page !== null);
}

function mapMetaPage(page: MetaAccountsResponse | MetaPageRaw) {
  if (
    !("id" in page) ||
    !("name" in page) ||
    !("access_token" in page) ||
    !page.id ||
    !page.name ||
    !page.access_token
  ) {
    return null;
  }

  return {
    accessToken: page.access_token,
    id: page.id,
    instagramBusinessAccount: page.instagram_business_account?.id
      ? {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username ?? null,
        }
      : null,
    name: page.name,
  } satisfies MetaPageAccount;
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
    .from(metaOAuthSessionsTable)
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
    throw metaStorageError({
      error,
      operation: "insert",
      query: `${metaStorageSchema}.${metaOAuthSessionsTable}.insert(...).select("id").single()`,
      schema: metaStorageSchema,
      table: metaOAuthSessionsTable,
    });
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
    .from(metaOAuthSessionsTable)
    .select("id, company_id, provider, pages, user_access_token")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    logMetaStorageError({
      error,
      operation: "select",
      query: `${metaStorageSchema}.${metaOAuthSessionsTable}.select("id, company_id, provider, pages, user_access_token").eq("id", sessionId).eq("company_id", companyId).gt("expires_at", now).single()`,
      schema: metaStorageSchema,
      table: metaOAuthSessionsTable,
    });
  }

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
    .from(metaIntegrationsTable)
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
    throw metaStorageError({
      error: integrationError,
      operation: "upsert",
      query: `${metaStorageSchema}.${metaIntegrationsTable}.upsert(..., { onConflict: "company_id,provider" }).select("id, provider").single()`,
      schema: metaStorageSchema,
      table: metaIntegrationsTable,
    });
  }

  const { data: facebookChannel, error: facebookChannelError } = await admin
    .from("channels")
    .upsert(
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
    )
    .select("id, channel_id, access_token, settings")
    .single<FacebookChannelRow>();

  if (facebookChannelError) {
    throw new Error(facebookChannelError.message);
  }

  savedChannels.push("facebook");

  if (facebookChannel?.channel_id && facebookChannel.access_token) {
    await subscribeFacebookPageWebhook({
      channelId: facebookChannel.id,
      existingSettings: facebookChannel.settings,
      pageAccessToken: facebookChannel.access_token,
      pageId: facebookChannel.channel_id,
    });
  }

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

export async function subscribeConnectedFacebookWebhook({
  companyId,
}: {
  companyId: string;
}) {
  const admin = createAdminClient();
  const { data: channel, error } = await admin
    .from("channels")
    .select("id, channel_id, access_token, settings")
    .eq("company_id", companyId)
    .eq("platform", "facebook")
    .eq("is_connected", true)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .single<FacebookChannelRow>();

  if (error || !channel) {
    throw new Error(error?.message ?? "No connected Facebook Page was found.");
  }

  if (!channel.channel_id || !channel.access_token) {
    throw new Error("Connected Facebook Page is missing its page access token.");
  }

  const subscription = await subscribeFacebookPageWebhook({
    channelId: channel.id,
    existingSettings: channel.settings,
    pageAccessToken: channel.access_token,
    pageId: channel.channel_id,
  });

  if (!subscription.ok) {
    throw Object.assign(
      new Error(
        subscription.payload.error?.message ??
          "Unable to subscribe Facebook Page webhook.",
      ),
      {
        metaError: subscription.payload.error ?? null,
        status: subscription.status,
      },
    );
  }

  return {
    channelId: channel.id,
    pageId: channel.channel_id,
    response: subscription.payload,
    subscribedAt: subscription.subscribedAt,
  };
}

export async function subscribeConnectedInstagramWebhook({
  companyId,
}: {
  companyId: string;
}) {
  const admin = createAdminClient();
  const { data: instagramChannel, error: instagramError } = await admin
    .from("channels")
    .select("id, settings")
    .eq("company_id", companyId)
    .eq("platform", "instagram")
    .eq("is_connected", true)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .single<Pick<FacebookChannelRow, "id" | "settings">>();

  if (instagramError || !instagramChannel) {
    throw new Error(
      instagramError?.message ?? "No connected Instagram channel was found.",
    );
  }

  const linkedPageId = readStringSetting(
    instagramChannel.settings,
    "linked_facebook_page_id",
  );

  if (!linkedPageId) {
    throw new Error(
      "Connected Instagram channel is missing its linked Facebook Page.",
    );
  }

  const { data: facebookChannel, error: facebookError } = await admin
    .from("channels")
    .select("channel_id, access_token")
    .eq("company_id", companyId)
    .eq("platform", "facebook")
    .eq("channel_id", linkedPageId)
    .eq("is_connected", true)
    .single<Pick<FacebookChannelRow, "access_token" | "channel_id">>();

  if (facebookError || !facebookChannel) {
    throw new Error(
      facebookError?.message ??
        "The Facebook Page linked to this Instagram channel is not connected.",
    );
  }

  if (!facebookChannel.access_token) {
    throw new Error(
      "The Facebook Page linked to this Instagram channel is missing its page access token.",
    );
  }

  const subscription = await subscribeMetaPageWebhook({
    channelId: instagramChannel.id,
    existingSettings: instagramChannel.settings,
    pageAccessToken: facebookChannel.access_token,
    pageId: linkedPageId,
    platform: "instagram",
    subscribedFields: instagramSubscribedFields,
  });

  if (!subscription.ok) {
    throw Object.assign(
      new Error(
        subscription.payload.error?.message ??
          "Unable to subscribe Instagram webhook.",
      ),
      {
        metaError: subscription.payload.error ?? null,
        status: subscription.status,
      },
    );
  }

  return {
    channelId: instagramChannel.id,
    pageId: linkedPageId,
    response: subscription.payload,
    subscribedAt: subscription.subscribedAt,
  };
}

async function subscribeFacebookPageWebhook({
  channelId,
  existingSettings,
  pageAccessToken,
  pageId,
}: {
  channelId: string;
  existingSettings: ChannelSettings | null;
  pageAccessToken: string;
  pageId: string;
}) {
  return subscribeMetaPageWebhook({
    channelId,
    existingSettings,
    pageAccessToken,
    pageId,
    platform: "facebook",
    subscribedFields: facebookMessengerSubscribedFields,
  });
}

async function subscribeMetaPageWebhook({
  channelId,
  existingSettings,
  pageAccessToken,
  pageId,
  platform,
  subscribedFields,
}: {
  channelId: string;
  existingSettings: ChannelSettings | null;
  pageAccessToken: string;
  pageId: string;
  platform: MetaProvider;
  subscribedFields: string;
}) {
  const url = new URL(
    `https://graph.facebook.com/${subscribedAppsGraphVersion}/${pageId}/subscribed_apps`,
  );
  const body = new URLSearchParams({
    access_token: pageAccessToken,
    subscribed_fields: subscribedFields,
  });

  const response = await fetch(url, {
    body,
    cache: "no-store",
    method: "POST",
  });
  const payload = (await response.json()) as MetaSubscribedAppsResponse;

  logMetaWebhookSubscription({
    channelId,
    metaError: payload.error ?? null,
    pageId,
    platform,
    response: payload,
    subscribedFields,
  });

  if (!response.ok || payload.error) {
    return {
      ok: false,
      payload,
      status: response.status,
      subscribedAt: null,
    };
  }

  const subscribedAt = new Date().toISOString();
  const { error: updateError } = await createAdminClient()
    .from("channels")
    .update({
      settings: {
        ...(existingSettings ?? {}),
        webhook_subscribed: true,
        webhook_subscribed_at: subscribedAt,
      },
    })
    .eq("id", channelId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    ok: true,
    payload,
    status: response.status,
    subscribedAt,
  };
}

function logMetaWebhookSubscription({
  channelId,
  metaError,
  pageId,
  platform,
  response,
  subscribedFields,
}: {
  channelId: string;
  metaError: MetaSubscribedAppsResponse["error"] | null;
  pageId: string;
  platform: MetaProvider;
  response: MetaSubscribedAppsResponse;
  subscribedFields: string;
}) {
  const message =
    platform === "facebook"
      ? "[meta-webhook] Facebook subscribed_apps response."
      : "[meta-webhook] Instagram subscribed_apps response.";

  console.info(message, {
    channel_id: channelId,
    meta_error_response: metaError,
    page_id: pageId,
    platform,
    subscribed_apps_response: response,
    subscribed_fields: subscribedFields,
  });
}

function readStringSetting(
  settings: ChannelSettings | null,
  key: string,
) {
  const value = settings?.[key];
  return typeof value === "string" && value.trim() ? value : null;
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
    throw metaApiError(
      payload.error?.message ?? "Unable to exchange long-lived Meta token.",
      payload.error,
      response.status,
    );
  }

  return payload.access_token;
}

function metaApiError(
  message: string,
  metaError: MetaTokenResponse["error"] | MetaAccountsResponse["error"],
  status: number,
) {
  return Object.assign(new Error(message), {
    metaError: metaError ?? null,
    status,
  });
}

async function deleteMetaOAuthSession(sessionId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from(metaOAuthSessionsTable)
    .delete()
    .eq("id", sessionId);

  if (error) {
    logMetaStorageError({
      error,
      operation: "delete",
      query: `${metaStorageSchema}.${metaOAuthSessionsTable}.delete().eq("id", sessionId)`,
      schema: metaStorageSchema,
      table: metaOAuthSessionsTable,
    });
  }
}

export async function getMetaStorageDebugDiagnostics() {
  const admin = createAdminClient();
  const activeQuery = await admin
    .from(metaOAuthSessionsTable)
    .select("id")
    .limit(1);
  const legacyPrivateQuery = await admin
    .schema("private")
    .from(metaOAuthSessionsTable)
    .select("id")
    .limit(1);

  return {
    active: {
      error: activeQuery.error,
      query: `${metaStorageSchema}.${metaOAuthSessionsTable}.select("id").limit(1)`,
      schema: metaStorageSchema,
      table: metaOAuthSessionsTable,
    },
    legacyPrivate: {
      error: legacyPrivateQuery.error,
      query: `private.${metaOAuthSessionsTable}.select("id").limit(1)`,
      schema: "private",
      table: metaOAuthSessionsTable,
    },
  };
}

function metaStorageError(diagnostic: SupabaseStorageDiagnostic) {
  logMetaStorageError(diagnostic);

  return Object.assign(new Error(storageErrorMessage(diagnostic)), {
    storageDiagnostic: diagnostic,
  });
}

function logMetaStorageError(diagnostic: SupabaseStorageDiagnostic) {
  console.error("[meta-storage] Supabase query failed.", {
    error: diagnostic.error,
    operation: diagnostic.operation,
    query: diagnostic.query,
    schema: diagnostic.schema,
    table: diagnostic.table,
  });
}

function storageErrorMessage(diagnostic: SupabaseStorageDiagnostic) {
  const errorMessage =
    diagnostic.error &&
    typeof diagnostic.error === "object" &&
    "message" in diagnostic.error &&
    typeof diagnostic.error.message === "string"
      ? diagnostic.error.message
      : "Meta OAuth storage query failed.";

  return `${errorMessage} (${diagnostic.schema}.${diagnostic.table})`;
}

function requiredMetaEnv(key: "META_APP_ID" | "META_APP_SECRET") {
  const value = readMetaEnv(key);

  if (!value) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}
