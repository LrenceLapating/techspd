import { createAdminClient } from "@/lib/supabase/admin";

export type MetaWebhookPlatform = "facebook" | "instagram";

export type MetaWebhookAttachment = {
  payload: Record<string, unknown> | null;
  type: string;
  url: string | null;
};

export type MetaWebhookMessageEvent = {
  attachments: MetaWebhookAttachment[];
  channelId: string;
  instagramId: string | null;
  messageId: string | null;
  pageId: string | null;
  platform: MetaWebhookPlatform;
  platformUserId: string;
  recipientId: string;
  text: string | null;
  timestamp: string;
};

export type MetaWebhookParseResult = {
  events: MetaWebhookMessageEvent[];
  ignored: number;
};

type ChannelRow = {
  channel_id: string | null;
  channel_name: string | null;
  company_id: string;
  external_id: string | null;
  id: string;
  platform: string | null;
};

type CustomerRow = {
  ai_enabled: boolean;
  id: string;
};

type ConversationRow = {
  id: string;
};

export type MetaWebhookIngestionResult = {
  channel_id: string;
  company_id: string;
  conversation_id: string;
  customer_id: string;
  message_id: string | null;
};

export function parseMetaWebhookEvents(body: unknown): MetaWebhookParseResult {
  if (!isRecord(body)) {
    return { events: [], ignored: 1 };
  }

  const platform = platformFromObject(optionalString(body.object));
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const events: MetaWebhookMessageEvent[] = [];
  let ignored = 0;

  if (!platform || entries.length === 0) {
    return { events, ignored: 1 };
  }

  for (const entry of entries) {
    if (!isRecord(entry)) {
      ignored += 1;
      continue;
    }

    const entryId = optionalString(entry.id);
    const fallbackTimestamp = timestampFromValue(entry.time);
    const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];

    for (const messagingEvent of messagingEvents) {
      const parsed = parseMessagingEvent({
        entryId,
        fallbackTimestamp,
        messagingEvent,
        platform,
      });

      if (parsed) {
        events.push(parsed);
      } else {
        ignored += 1;
      }
    }
  }

  return { events, ignored };
}

export async function ingestMetaWebhookMessage(
  event: MetaWebhookMessageEvent,
): Promise<MetaWebhookIngestionResult> {
  const supabase = createAdminClient();
  const channel = await findConnectedChannel(event);
  const body = event.text ?? "[Attachment]";
  const customerExternalId = `${event.platform}:${event.platformUserId}`;

  const customer = await findOrCreateCustomer({
    companyId: channel.company_id,
    event,
    externalId: customerExternalId,
  });
  const conversation = await findOrCreateConversation({
    body,
    channel,
    customerId: customer.id,
    sentAt: event.timestamp,
  });

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      body,
      company_id: channel.company_id,
      conversation_id: conversation.id,
      customer_id: customer.id,
      metadata: {
        ai_reply_allowed: customer.ai_enabled,
        attachments: event.attachments,
        instagram_id: event.instagramId,
        message_id: event.messageId,
        page_id: event.pageId,
        platform: event.platform,
        platform_channel_id: event.channelId,
        platform_user_id: event.platformUserId,
        recipient_id: event.recipientId,
        source: "meta_webhook",
      },
      sender_type: "customer",
      sent_at: event.timestamp,
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(messageError.message);
  }

  await supabase
    .from("customers")
    .update({
      last_activity_at: event.timestamp,
      platform: event.platform,
    })
    .eq("id", customer.id)
    .eq("company_id", channel.company_id);

  await supabase
    .from("conversations")
    .update({
      last_message: body,
      last_message_at: event.timestamp,
      status: "open",
    })
    .eq("id", conversation.id)
    .eq("company_id", channel.company_id);

  return {
    channel_id: channel.id,
    company_id: channel.company_id,
    conversation_id: conversation.id,
    customer_id: customer.id,
    message_id: message?.id ?? null,
  };
}

async function findConnectedChannel(event: MetaWebhookMessageEvent) {
  const supabase = createAdminClient();

  const { data: byChannelId, error: channelIdError } = await supabase
    .from("channels")
    .select("id, company_id, platform, channel_id, channel_name, external_id")
    .eq("platform", event.platform)
    .eq("channel_id", event.channelId)
    .eq("is_connected", true)
    .maybeSingle();

  if (channelIdError) {
    throw new Error(channelIdError.message);
  }

  if (byChannelId) {
    return byChannelId as ChannelRow;
  }

  const { data: byExternalId, error: externalIdError } = await supabase
    .from("channels")
    .select("id, company_id, platform, channel_id, channel_name, external_id")
    .eq("platform", event.platform)
    .eq("external_id", event.channelId)
    .eq("is_connected", true)
    .maybeSingle();

  if (externalIdError) {
    throw new Error(externalIdError.message);
  }

  if (byExternalId) {
    return byExternalId as ChannelRow;
  }

  throw new Error(
    `No connected ${event.platform} channel found for ${event.channelId}.`,
  );
}

async function findOrCreateCustomer({
  companyId,
  event,
  externalId,
}: {
  companyId: string;
  event: MetaWebhookMessageEvent;
  externalId: string;
}) {
  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, ai_enabled")
    .eq("company_id", companyId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existing) {
    return existing as CustomerRow;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      external_id: externalId,
      last_activity_at: event.timestamp,
      metadata: {
        platform_user_id: event.platformUserId,
        source: "meta_webhook",
      },
      name: fallbackCustomerName(event.platform, event.platformUserId),
      platform: event.platform,
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
  channel,
  customerId,
  sentAt,
}: {
  body: string;
  channel: ChannelRow;
  customerId: string;
  sentAt: string;
}) {
  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("company_id", channel.company_id)
    .eq("customer_id", customerId)
    .eq("channel_id", channel.id)
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
      channel_id: channel.id,
      company_id: channel.company_id,
      customer_id: customerId,
      last_message: body,
      last_message_at: sentAt,
      status: "open",
      subject: `${formatPlatform(channel.platform)} message`,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ConversationRow;
}

function parseMessagingEvent({
  entryId,
  fallbackTimestamp,
  messagingEvent,
  platform,
}: {
  entryId: string | null;
  fallbackTimestamp: string;
  messagingEvent: unknown;
  platform: MetaWebhookPlatform;
}) {
  if (!isRecord(messagingEvent)) {
    return null;
  }

  const sender = isRecord(messagingEvent.sender) ? messagingEvent.sender : null;
  const recipient = isRecord(messagingEvent.recipient)
    ? messagingEvent.recipient
    : null;
  const message = isRecord(messagingEvent.message) ? messagingEvent.message : null;
  const platformUserId = optionalString(sender?.id);
  const recipientId = optionalString(recipient?.id) ?? entryId;
  const isEcho = message?.is_echo === true;

  if (!message || !platformUserId || !recipientId || isEcho) {
    return null;
  }

  if (platformUserId === recipientId) {
    return null;
  }

  const text = optionalString(message.text);
  const attachments = parseAttachments(message.attachments);

  if (!text && attachments.length === 0) {
    return null;
  }

  return {
    attachments,
    channelId: recipientId,
    instagramId: platform === "instagram" ? recipientId : null,
    messageId: optionalString(message.mid),
    pageId: platform === "facebook" ? recipientId : null,
    platform,
    platformUserId,
    recipientId,
    text,
    timestamp: timestampFromValue(messagingEvent.timestamp, fallbackTimestamp),
  } satisfies MetaWebhookMessageEvent;
}

function parseAttachments(value: unknown): MetaWebhookAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((attachment) => {
    const payload = isRecord(attachment.payload) ? attachment.payload : null;

    return {
      payload,
      type: optionalString(attachment.type) ?? "unknown",
      url: payload ? optionalString(payload.url) : null,
    };
  });
}

function platformFromObject(value: string | null): MetaWebhookPlatform | null {
  if (value === "instagram") {
    return "instagram";
  }

  if (value === "page") {
    return "facebook";
  }

  return null;
}

function timestampFromValue(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return fallback;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fallbackCustomerName(platform: MetaWebhookPlatform, platformUserId: string) {
  const suffix = platformUserId.slice(-6) || "unknown";

  return `${formatPlatform(platform)} User ${suffix}`;
}

function formatPlatform(value: string | null) {
  const platform = value || "Social";

  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
