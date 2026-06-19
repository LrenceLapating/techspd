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
  entryId: string | null;
  instagramId: string | null;
  messageIsEcho: boolean;
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
  ignoredEvents: MetaWebhookIgnoredEvent[];
};

export type MetaWebhookIgnoredEvent = {
  bodyObject: string | null;
  changesKeys: string[];
  entryId: string | null;
  entryKeys: string[];
  messageIsEcho: boolean | null;
  messageId: string | null;
  messageText: string | null;
  messagingKeys: string[];
  recipientId: string | null;
  reason: string;
  senderId: string | null;
};

type ChannelRow = {
  access_token: string | null;
  channel_id: string | null;
  channel_name: string | null;
  company_id: string;
  external_id: string | null;
  id: string;
  platform: string | null;
};

type CustomerRow = {
  ai_enabled: boolean;
  avatar_url: string | null;
  id: string;
  name: string;
};

type FacebookCustomerProfile = {
  avatarUrl: string | null;
  name: string | null;
};

type MetaCustomerProfileResponse = {
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
  id?: string;
  name?: string;
  profile_pic?: string;
};

type ConversationRow = {
  id: string;
};

type ExistingMessageContextRow = {
  channel_id: string;
  channels: ChannelRow | ChannelRow[];
  company_id: string;
  customer_id: string;
  customers: CustomerRow | CustomerRow[];
  id: string;
};

export type MetaWebhookIngestionResult = {
  channel_id: string;
  company_id: string;
  conversation_id: string;
  customer_id: string;
  database_inserted_at: string;
  message_id: string | null;
  matched_channel_id: string;
  webhook_received_at: string;
  webhook_to_database_ms: number;
};

export function parseMetaWebhookEvents(body: unknown): MetaWebhookParseResult {
  if (!isRecord(body)) {
    return {
      events: [],
      ignored: 1,
      ignoredEvents: [ignoredEvent({ reason: "body_is_not_an_object" })],
    };
  }

  const bodyObject = optionalString(body.object);
  const platform = platformFromObject(bodyObject);
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const events: MetaWebhookMessageEvent[] = [];
  const ignoredEvents: MetaWebhookIgnoredEvent[] = [];
  let ignored = 0;

  if (!platform) {
    return {
      events,
      ignored: 1,
      ignoredEvents: [
        ignoredEvent({
          bodyObject,
          reason: `unsupported_object:${bodyObject ?? "missing"}`,
        }),
      ],
    };
  }

  if (entries.length === 0) {
    return {
      events,
      ignored: 1,
      ignoredEvents: [ignoredEvent({ bodyObject, reason: "entry_is_missing" })],
    };
  }

  for (const entry of entries) {
    if (!isRecord(entry)) {
      ignored += 1;
      ignoredEvents.push(
        ignoredEvent({ bodyObject, reason: "entry_is_not_an_object" }),
      );
      continue;
    }

    const entryId = optionalString(entry.id);
    const entryKeys = Object.keys(entry).sort();
    const hasChanges = Object.prototype.hasOwnProperty.call(entry, "changes");
    const changesKeys = nestedRecordKeys(entry.changes);
    const fallbackTimestamp = timestampFromValue(entry.time);
    const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];

    if (messagingEvents.length === 0) {
      ignored += 1;
      ignoredEvents.push(
        ignoredEvent({
          bodyObject,
          changesKeys,
          entryId,
          entryKeys,
          reason:
            hasChanges
              ? "entry_has_changes_but_no_messaging"
              : "entry_has_no_messaging",
        }),
      );
      continue;
    }

    for (const messagingEvent of messagingEvents) {
      const messagingKeys = isRecord(messagingEvent)
        ? Object.keys(messagingEvent).sort()
        : [];
      const parsed = parseMessagingEvent({
        entryId,
        fallbackTimestamp,
        messagingEvent,
        platform,
      });

      if (parsed.event) {
        events.push(parsed.event);
      } else {
        ignored += 1;
        ignoredEvents.push(
          ignoredEvent({
            bodyObject,
            changesKeys,
            entryId,
            entryKeys,
            messageIsEcho: parsed.messageIsEcho,
            messageText: parsed.messageText,
            messagingKeys,
            recipientId: parsed.recipientId,
            reason: parsed.reason,
            senderId: parsed.senderId,
          }),
        );
      }
    }
  }

  return { events, ignored, ignoredEvents };
}

export async function ingestMetaWebhookMessage(
  event: MetaWebhookMessageEvent,
  {
    traceId = "untracked",
    webhookReceivedAt = new Date().toISOString(),
  }: { traceId?: string; webhookReceivedAt?: string } = {},
): Promise<MetaWebhookIngestionResult> {
  const supabase = createAdminClient();
  const body = event.text ?? "[Attachment]";
  const customerExternalId = `${event.platform}:${event.platformUserId}`;
  const contextLookupStartedAt = Date.now();
  let currentStage: MetaWebhookTraceStage = "existing_context_lookup";
  let channel: ChannelRow;
  let customer: CustomerRow;
  let conversation: ConversationRow;

  try {
    const existingContext = await findExistingMessageContext(
      event,
      customerExternalId,
    );

    if (existingContext) {
      channel = existingContext.channel;
      customer = existingContext.customer;
      conversation = { id: existingContext.conversationId };
      logMetaFlowTrace({ channel, event, result: "matched", stage: "channel_lookup", traceId });
      logMetaFlowTrace({ channel, event, recordId: customer.id, result: "existing", stage: "customer_lookup", traceId });
      logMetaFlowTrace({ channel, event, recordId: conversation.id, result: "existing", stage: "conversation_lookup", traceId });
    } else {
      currentStage = "channel_lookup";
      channel = await findConnectedChannel(event);
      logMetaFlowTrace({ channel, event, result: "matched", stage: currentStage, traceId });

      currentStage = "customer_lookup";
      customer = await findOrCreateCustomer({
        companyId: channel.company_id,
        event,
        externalId: customerExternalId,
      });
      logMetaFlowTrace({ channel, event, recordId: customer.id, result: "resolved", stage: currentStage, traceId });

      currentStage = "conversation_lookup";
      conversation = await findOrCreateConversation({
        body,
        channel,
        customerId: customer.id,
        sentAt: event.timestamp,
      });
      logMetaFlowTrace({ channel, event, recordId: conversation.id, result: "resolved", stage: currentStage, traceId });
    }

    const contextLookupMs = Date.now() - contextLookupStartedAt;
    currentStage = "message_insert";
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
          webhook_received_at: webhookReceivedAt,
        },
        sender_type: "customer",
        sent_at: event.timestamp,
      })
      .select("id, created_at")
      .single();

    if (messageError) {
      throw new Error(messageError.message);
    }

    logMetaFlowTrace({ channel, event, recordId: message.id, result: "inserted", stage: "message_insert", traceId });

    const databaseInsertedAt = message.created_at;
    const webhookToDatabaseMs = Math.max(
      0,
      new Date(databaseInsertedAt).getTime() - new Date(webhookReceivedAt).getTime(),
    );

    console.info("[TechSpd Latency] message inserted", {
      databaseInsertedAt,
      contextLookupMs,
      fastPath: Boolean(existingContext),
      messageId: message.id,
      trace_id: traceId,
      webhookReceivedAt,
      webhookToDatabaseMs,
    });

    const profilePromise = fetchFacebookCustomerProfile({ channel, event }).then(
      (profile) =>
        profile
          ? updateCustomerProfile({
              companyId: channel.company_id,
              customerId: customer.id,
              profile,
            })
          : undefined,
    );

    currentStage = "post_insert_updates";
    await Promise.all([
      supabase
        .from("customers")
        .update({ last_activity_at: event.timestamp, platform: event.platform })
        .eq("id", customer.id)
        .eq("company_id", channel.company_id),
      supabase
        .from("conversations")
        .update({ last_message: body, last_message_at: event.timestamp, status: "open" })
        .eq("id", conversation.id)
        .eq("company_id", channel.company_id),
      profilePromise,
    ]);

    return {
      channel_id: channel.id,
      company_id: channel.company_id,
      conversation_id: conversation.id,
      customer_id: customer.id,
      database_inserted_at: databaseInsertedAt,
      message_id: message.id,
      matched_channel_id: channel.channel_id ?? channel.external_id ?? event.channelId,
      webhook_received_at: webhookReceivedAt,
      webhook_to_database_ms: webhookToDatabaseMs,
    };
  } catch (error) {
    console.error("[meta-webhook] STOP.", {
      body_object: event.platform === "instagram" ? "instagram" : "page",
      channel_id_requested: event.channelId,
      entry_id: event.entryId,
      error,
      execution_exit: currentStage,
      message_id: event.messageId,
      message_is_echo: event.messageIsEcho,
      message_text: event.text,
      platform_resolved: event.platform,
      recipient_id: event.recipientId,
      sender_id: event.platformUserId,
      stop_reason: error instanceof Error ? error.message : "unknown_error",
      trace_id: traceId,
    });
    throw error;
  }
}

type MetaWebhookTraceStage =
  | "existing_context_lookup"
  | "channel_lookup"
  | "customer_lookup"
  | "conversation_lookup"
  | "message_insert"
  | "post_insert_updates";

function logMetaFlowTrace({
  channel,
  event,
  recordId = null,
  result,
  stage,
  traceId,
}: {
  channel: ChannelRow;
  event: MetaWebhookMessageEvent;
  recordId?: string | null;
  result: "existing" | "inserted" | "matched" | "resolved";
  stage: Exclude<MetaWebhookTraceStage, "existing_context_lookup" | "post_insert_updates">;
  traceId: string;
}) {
  console.info("[meta-webhook] Flow trace.", {
    channel_id_matched: channel.channel_id ?? channel.external_id,
    company_id: channel.company_id,
    entry_id: event.entryId,
    internal_channel_id: channel.id,
    platform_resolved: event.platform,
    recipient_id: event.recipientId,
    record_id: recordId,
    result,
    sender_id: event.platformUserId,
    stage,
    trace_id: traceId,
  });
}

async function findExistingMessageContext(
  event: MetaWebhookMessageEvent,
  customerExternalId: string,
) {
  const supabase = createAdminClient();
  const channelIdentifiers = metaChannelIdentifiers(event);
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, company_id, customer_id, channel_id, channels!inner(id,company_id,platform,channel_id,channel_name,external_id,access_token,is_connected), customers!inner(id,ai_enabled,name,avatar_url,external_id)",
    )
    .eq("channels.platform", event.platform)
    .in("channels.channel_id", channelIdentifiers)
    .eq("channels.is_connected", true)
    .eq("customers.external_id", customerExternalId)
    .in("status", ["open", "pending"])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as ExistingMessageContextRow;
  const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  if (!channel || !customer) {
    return null;
  }

  return {
    channel,
    conversationId: row.id,
    customer,
  };
}

async function findConnectedChannel(event: MetaWebhookMessageEvent) {
  const supabase = createAdminClient();
  const channelIdentifiers = metaChannelIdentifiers(event);

  const { data: byChannelId, error: channelIdError } = await supabase
    .from("channels")
    .select(
      "id, company_id, platform, channel_id, channel_name, external_id, access_token",
    )
    .eq("platform", event.platform)
    .in("channel_id", channelIdentifiers)
    .eq("is_connected", true)
    .limit(1)
    .maybeSingle();

  if (channelIdError) {
    throw new Error(channelIdError.message);
  }

  if (byChannelId) {
    return byChannelId as ChannelRow;
  }

  const { data: byExternalId, error: externalIdError } = await supabase
    .from("channels")
    .select(
      "id, company_id, platform, channel_id, channel_name, external_id, access_token",
    )
    .eq("platform", event.platform)
    .in("external_id", channelIdentifiers)
    .eq("is_connected", true)
    .limit(1)
    .maybeSingle();

  if (externalIdError) {
    throw new Error(externalIdError.message);
  }

  if (byExternalId) {
    return byExternalId as ChannelRow;
  }

  throw new Error(
    `No connected ${event.platform} channel found for ${channelIdentifiers.join(" or ")}.`,
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
    .select("id, ai_enabled, name, avatar_url")
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
      avatar_url: null,
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

async function updateCustomerProfile({
  companyId,
  customerId,
  profile,
}: {
  companyId: string;
  customerId: string;
  profile: FacebookCustomerProfile;
}) {
  const supabase = createAdminClient();
  const updates: { avatar_url?: string; name?: string } = {};

  if (profile.avatarUrl) {
    updates.avatar_url = profile.avatarUrl;
  }

  if (profile.name) {
    updates.name = profile.name;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", customerId)
    .eq("company_id", companyId);

  if (error) {
    console.warn("[meta-webhook] Customer profile update failed.", {
      customer_id: customerId,
      error: error.message,
    });
  }
}

async function fetchFacebookCustomerProfile({
  channel,
  event,
}: {
  channel: ChannelRow;
  event: MetaWebhookMessageEvent;
}): Promise<FacebookCustomerProfile | null> {
  if (event.platform !== "facebook" || !channel.access_token) {
    return null;
  }

  const graphVersion = process.env.META_GRAPH_VERSION ?? "v20.0";
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(event.platformUserId)}`,
  );
  url.searchParams.set("fields", "name,profile_pic");
  url.searchParams.set("access_token", channel.access_token);

  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as MetaCustomerProfileResponse;

    if (!response.ok || payload.error) {
      console.warn("[meta-webhook] Facebook customer profile lookup failed.", {
        error: payload.error ?? { status: response.status },
        platform_user_id: event.platformUserId,
      });
      return null;
    }

    return {
      avatarUrl: optionalString(payload.profile_pic),
      name: optionalString(payload.name),
    };
  } catch (error) {
    console.warn("[meta-webhook] Facebook customer profile lookup failed.", {
      error,
      platform_user_id: event.platformUserId,
    });
    return null;
  }
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
    return ignoredMessagingEvent("messaging_event_is_not_an_object");
  }

  const sender = isRecord(messagingEvent.sender) ? messagingEvent.sender : null;
  const recipient = isRecord(messagingEvent.recipient)
    ? messagingEvent.recipient
    : null;
  const message = isRecord(messagingEvent.message) ? messagingEvent.message : null;
  const platformUserId = optionalString(sender?.id);
  const recipientId = optionalString(recipient?.id) ?? entryId;
    const messageIsEcho = message?.is_echo === true;
  const messageId = message ? optionalString(message.mid) : null;
  const messageText = optionalString(message?.text);
  const messageDetails = {
    messageIsEcho,
    messageId,
    messageText,
    recipientId,
    senderId: platformUserId,
  };

  if (!message) {
    return ignoredMessagingEvent("message_is_missing", messageDetails);
  }

  if (!platformUserId) {
    return ignoredMessagingEvent("sender_id_is_missing", messageDetails);
  }

  if (!recipientId) {
    return ignoredMessagingEvent("recipient_id_is_missing", messageDetails);
  }

  if (messageIsEcho) {
    return ignoredMessagingEvent("message_is_echo", messageDetails);
  }

  if (platform === "facebook" && platformUserId === recipientId) {
    return ignoredMessagingEvent("sender_matches_recipient", messageDetails);
  }

  const text = messageText;
  const attachments = parseAttachments(message.attachments);

  if (!text && attachments.length === 0) {
    return ignoredMessagingEvent(
      "message_has_no_text_or_attachments",
      messageDetails,
    );
  }

  const channelId = platform === "instagram" ? (entryId ?? recipientId) : recipientId;

  return {
    event: {
      attachments,
      channelId,
      entryId,
      instagramId: platform === "instagram" ? channelId : null,
      messageIsEcho,
      messageId,
      pageId: platform === "facebook" ? channelId : null,
      platform,
      platformUserId,
      recipientId,
      text,
      timestamp: timestampFromValue(messagingEvent.timestamp, fallbackTimestamp),
    } satisfies MetaWebhookMessageEvent,
    ...messageDetails,
    reason: null,
  } as const;
}

function ignoredMessagingEvent(
  reason: string,
  details: {
    messageIsEcho: boolean;
    messageId: string | null;
    messageText: string | null;
    recipientId: string | null;
    senderId: string | null;
  } = {
    messageIsEcho: false,
    messageId: null,
    messageText: null,
    recipientId: null,
    senderId: null,
  },
) {
  return {
    event: null,
    ...details,
    reason,
  } as const;
}

function metaChannelIdentifiers(event: MetaWebhookMessageEvent) {
  return Array.from(
    new Set(
      [event.channelId, event.entryId, event.recipientId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

function ignoredEvent({
  bodyObject = null,
  changesKeys = [],
  entryId = null,
  entryKeys = [],
  messageIsEcho = null,
  messageId = null,
  messageText = null,
  messagingKeys = [],
  recipientId = null,
  reason,
  senderId = null,
}: Partial<Omit<MetaWebhookIgnoredEvent, "reason">> & { reason: string }) {
  return {
    bodyObject,
    changesKeys,
    entryId,
    entryKeys,
    messageIsEcho,
    messageId,
    messageText,
    messagingKeys,
    recipientId,
    reason,
    senderId,
  } satisfies MetaWebhookIgnoredEvent;
}

function nestedRecordKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const keys = value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const nestedValue = isRecord(item.value) ? Object.keys(item.value) : [];
    return [...Object.keys(item), ...nestedValue];
  });

  return Array.from(new Set(keys)).sort();
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
  if (platform === "facebook") {
    return `Facebook User ${platformUserId}`;
  }

  const suffix = platformUserId.slice(-6) || "unknown";

  return `${formatPlatform(platform)} User ${suffix}`;
}

function formatPlatform(value: string | null) {
  const platform = value || "Social";

  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
