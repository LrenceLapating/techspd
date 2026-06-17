import { createAdminClient } from "@/lib/supabase/admin";

const platforms = ["facebook", "instagram", "tiktok"] as const;

type IncomingPlatform = (typeof platforms)[number];

export type IncomingMessagePayload = {
  attachment_url?: string | null;
  channel_id: string;
  company_id: string;
  customer_name: string;
  message: string;
  platform: IncomingPlatform;
  platform_user_id: string;
  timestamp: string;
};

type ChannelRow = {
  id: string;
};

type CustomerRow = {
  ai_enabled: boolean;
  id: string;
};

type ConversationRow = {
  id: string;
};

export type IncomingMessageResult = {
  ai_enabled: boolean;
  conversation_id: string;
  customer_id: string;
};

export function parseIncomingMessageBody(body: unknown): IncomingMessagePayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const payload = {
    attachment_url: optionalString(record.attachment_url),
    channel_id: requiredString(record.channel_id, "channel_id"),
    company_id: requiredUuid(record.company_id, "company_id"),
    customer_name: requiredString(record.customer_name, "customer_name"),
    message: optionalString(record.message) ?? "",
    platform: parsePlatform(record.platform),
    platform_user_id: requiredString(record.platform_user_id, "platform_user_id"),
    timestamp: requiredTimestamp(record.timestamp, "timestamp"),
  };

  if (!payload.message && !payload.attachment_url) {
    throw new Error("message or attachment_url is required.");
  }

  return payload;
}

export async function ingestIncomingMessage(
  payload: IncomingMessagePayload,
): Promise<IncomingMessageResult> {
  const supabase = createAdminClient();
  const sentAt = new Date(payload.timestamp).toISOString();
  const customerExternalId = `${payload.platform}:${payload.platform_user_id}`;

  const channel = await findOrCreateChannel({
    channelExternalId: payload.channel_id,
    companyId: payload.company_id,
    platform: payload.platform,
  });

  const customer = await findOrCreateCustomer({
    companyId: payload.company_id,
    customerExternalId,
    customerName: payload.customer_name,
    platform: payload.platform,
    sentAt,
  });

  const body = payload.message || "[Attachment]";
  const conversation = await findOrCreateConversation({
    body,
    channelId: channel.id,
    companyId: payload.company_id,
    customerId: customer.id,
    sentAt,
  });

  const { error: messageError } = await supabase.from("messages").insert({
    body,
    company_id: payload.company_id,
    conversation_id: conversation.id,
    customer_id: customer.id,
    metadata: {
      ai_reply_allowed: customer.ai_enabled,
      attachment_url: payload.attachment_url ?? null,
      platform: payload.platform,
      platform_channel_id: payload.channel_id,
      platform_user_id: payload.platform_user_id,
      source: "n8n_incoming_message",
    },
    sender_type: "customer",
    sent_at: sentAt,
  });

  if (messageError) {
    throw new Error(messageError.message);
  }

  await supabase
    .from("customers")
    .update({
      last_activity_at: sentAt,
    })
    .eq("id", customer.id)
    .eq("company_id", payload.company_id);

  await supabase
    .from("conversations")
    .update({
      last_message: body,
      last_message_at: sentAt,
      status: "open",
    })
    .eq("id", conversation.id)
    .eq("company_id", payload.company_id);

  return {
    ai_enabled: customer.ai_enabled,
    conversation_id: conversation.id,
    customer_id: customer.id,
  };
}

async function findOrCreateChannel({
  channelExternalId,
  companyId,
  platform,
}: {
  channelExternalId: string;
  companyId: string;
  platform: IncomingPlatform;
}) {
  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("channels")
    .select("id")
    .eq("company_id", companyId)
    .eq("external_id", channelExternalId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existing) {
    return existing as ChannelRow;
  }

  const { data, error } = await supabase
    .from("channels")
    .insert({
      company_id: companyId,
      external_id: channelExternalId,
      name: `${formatPlatform(platform)} ${channelExternalId}`,
      settings: {
        external_id: channelExternalId,
        platform,
      },
      type: "social",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ChannelRow;
}

async function findOrCreateCustomer({
  companyId,
  customerExternalId,
  customerName,
  platform,
  sentAt,
}: {
  companyId: string;
  customerExternalId: string;
  customerName: string;
  platform: IncomingPlatform;
  sentAt: string;
}) {
  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, ai_enabled")
    .eq("company_id", companyId)
    .eq("external_id", customerExternalId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existing) {
    await supabase
      .from("customers")
      .update({
        last_activity_at: sentAt,
        name: customerName,
        platform,
      })
      .eq("id", existing.id)
      .eq("company_id", companyId);

    return existing as CustomerRow;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      external_id: customerExternalId,
      last_activity_at: sentAt,
      metadata: {
        source: "n8n_incoming_message",
      },
      name: customerName,
      platform,
    })
    .select("id, ai_enabled")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CustomerRow;
}

async function findOrCreateConversation({
  body,
  channelId,
  companyId,
  customerId,
  sentAt,
}: {
  body: string;
  channelId: string;
  companyId: string;
  customerId: string;
  sentAt: string;
}) {
  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .eq("channel_id", channelId)
    .in("status", ["open", "pending"])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existing) {
    return existing as ConversationRow;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      channel_id: channelId,
      company_id: companyId,
      customer_id: customerId,
      last_message: body,
      last_message_at: sentAt,
      status: "open",
      subject: "Social message",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ConversationRow;
}

function requiredString(value: unknown, key: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
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

function requiredTimestamp(value: unknown, key: string) {
  const parsed = requiredString(value, key);
  const date = new Date(parsed);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${key} must be a valid timestamp.`);
  }

  return parsed;
}

function parsePlatform(value: unknown): IncomingPlatform {
  const parsed = requiredString(value, "platform").toLowerCase();

  if (!platforms.includes(parsed as IncomingPlatform)) {
    throw new Error("platform must be facebook, instagram, or tiktok.");
  }

  return parsed as IncomingPlatform;
}

function formatPlatform(platform: IncomingPlatform) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
