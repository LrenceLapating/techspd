import type { SupabaseClient } from "@supabase/supabase-js";

type SendManualReplyBody = {
  conversation_id: string;
  customer_id: string;
  message: string;
};

type ProfileRow = {
  company_id: string | null;
};

type ConversationRow = {
  channel_id: string | null;
  company_id: string;
  customer_id: string;
  id: string;
};

type CustomerRow = {
  ai_enabled: boolean;
  external_id: string | null;
  id: string;
  platform: string | null;
};

type ChannelRow = {
  access_token: string | null;
  channel_id: string | null;
  channel_name: string | null;
  company_id: string;
  id: string;
  platform: string | null;
  settings: Record<string, unknown> | null;
};

type MetaSendResponse = {
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
  message_id?: string;
  recipient_id?: string;
};

export type ManualReplyResult = {
  conversation_id: string;
  message_id: string;
  meta_message_id: string | null;
  success: true;
};

export function parseManualReplyBody(body: unknown): SendManualReplyBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const message = requiredString(record.message, "message");

  return {
    conversation_id: requiredUuid(record.conversation_id, "conversation_id"),
    customer_id: requiredUuid(record.customer_id, "customer_id"),
    message,
  };
}

export async function sendManualReply({
  payload,
  supabase,
}: {
  payload: SendManualReplyBody;
  supabase: SupabaseClient;
}): Promise<ManualReplyResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw httpError("Unauthorized", 401);
  }

  const companyId = await getUserCompanyId(supabase, user.id);
  const conversation = await getConversation({
    companyId,
    conversationId: payload.conversation_id,
    customerId: payload.customer_id,
    supabase,
  });
  const [customer, channel] = await Promise.all([
    getCustomer({
      companyId,
      customerId: conversation.customer_id,
      supabase,
    }),
    getChannel({
      channelId: conversation.channel_id,
      companyId,
      supabase,
    }),
  ]);
  const platform = normalizePlatform(channel.platform ?? customer.platform);
  const recipientId = platformUserIdFromCustomer(customer);

  if (!recipientId) {
    throw httpError("Customer is missing a platform user ID.", 422);
  }

  if (!channel.access_token) {
    throw httpError("Connected channel is missing an access token.", 422);
  }

  const graphSenderId = graphSenderIdForChannel(channel, platform);

  if (!graphSenderId) {
    throw httpError("Connected channel is missing its Meta send endpoint ID.", 422);
  }

  const metaResponse = await sendMetaMessage({
    accessToken: channel.access_token,
    channelId: graphSenderId,
    message: payload.message,
    platform,
    recipientId,
  });
  const sentAt = new Date().toISOString();
  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      body: payload.message,
      company_id: companyId,
      conversation_id: conversation.id,
      customer_id: customer.id,
      metadata: {
        ai_reply_allowed: customer.ai_enabled,
        meta_message_id: metaResponse.message_id ?? null,
        platform,
        platform_channel_id: channel.channel_id,
        platform_user_id: recipientId,
        source: "manual_owner_reply",
      },
      sender_type: "owner",
      sender_user_id: user.id,
      sent_at: sentAt,
    })
    .select("id")
    .single();

  if (insertError) {
    throw httpError(insertError.message, 500);
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      last_message: payload.message,
      last_message_at: sentAt,
      status: "open",
    })
    .eq("id", conversation.id)
    .eq("company_id", companyId);

  if (updateError) {
    throw httpError(updateError.message, 500);
  }

  return {
    conversation_id: conversation.id,
    message_id: insertedMessage.id as string,
    meta_message_id: metaResponse.message_id ?? null,
    success: true,
  };
}

export function manualReplyErrorResponse(error: unknown) {
  if (isHttpError(error)) {
    return {
      body: { error: error.message },
      status: error.status,
    };
  }

  return {
    body: {
      error:
        error instanceof Error ? error.message : "Manual message send failed.",
    },
    status: 500,
  };
}

async function getUserCompanyId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (error) {
    throw httpError(error.message, 500);
  }

  const companyId = (data as ProfileRow | null)?.company_id;

  if (!companyId) {
    throw httpError("Company not found for logged-in user.", 404);
  }

  return companyId;
}

async function getConversation({
  companyId,
  conversationId,
  customerId,
  supabase,
}: {
  companyId: string;
  conversationId: string;
  customerId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, company_id, customer_id, channel_id")
    .eq("id", conversationId)
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .single();

  if (error || !data) {
    throw httpError("Conversation was not found for this company.", 404);
  }

  return data as ConversationRow;
}

async function getCustomer({
  companyId,
  customerId,
  supabase,
}: {
  companyId: string;
  customerId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, external_id, platform, ai_enabled")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw httpError("Customer was not found for this company.", 404);
  }

  return data as CustomerRow;
}

async function getChannel({
  channelId,
  companyId,
  supabase,
}: {
  channelId: string | null;
  companyId: string;
  supabase: SupabaseClient;
}) {
  if (!channelId) {
    throw httpError("Conversation is not linked to a connected channel.", 422);
  }

  const { data, error } = await supabase
    .from("channels")
    .select("id, company_id, platform, channel_id, channel_name, access_token, settings")
    .eq("id", channelId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw httpError("Connected channel was not found for this company.", 404);
  }

  return data as ChannelRow;
}

function graphSenderIdForChannel(
  channel: ChannelRow,
  platform: "facebook" | "instagram",
) {
  if (platform === "instagram") {
    const linkedPageId = channel.settings?.linked_facebook_page_id;

    return typeof linkedPageId === "string" && linkedPageId.trim()
      ? linkedPageId
      : channel.channel_id;
  }

  return channel.channel_id;
}

async function sendMetaMessage({
  accessToken,
  channelId,
  message,
  platform,
  recipientId,
}: {
  accessToken: string;
  channelId: string;
  message: string;
  platform: "facebook" | "instagram";
  recipientId: string;
}) {
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${channelId}/messages`,
    {
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        message: {
          text: message,
        },
        recipient: {
          id: recipientId,
        },
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => ({}))) as MetaSendResponse;

  if (!response.ok || payload.error) {
    const metaMessage =
      payload.error?.message ??
      `Meta ${platform} send failed with status ${response.status}.`;

    throw httpError(metaMessage, 502);
  }

  return payload;
}

function platformUserIdFromCustomer(customer: CustomerRow) {
  if (!customer.external_id) {
    return null;
  }

  const [, platformUserId] = customer.external_id.split(":");

  return platformUserId || customer.external_id;
}

function normalizePlatform(value: string | null): "facebook" | "instagram" {
  if (value === "facebook" || value === "instagram") {
    return value;
  }

  throw httpError("Manual replies are only available for Facebook and Instagram.", 422);
}

function requiredString(value: unknown, key: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function requiredUuid(value: unknown, key: string) {
  const parsed = requiredString(value, key);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      parsed,
    )
  ) {
    throw new Error(`${key} must be a valid UUID.`);
  }

  return parsed;
}

function httpError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function isHttpError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  );
}
