import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type ProcessMessagePayload = {
  conversation_id: string;
  customer_id: string;
  message_id: string;
};

type SaveAiReplyPayload = {
  ai_message: string;
  conversation_id: string;
  customer_id: string;
  meta_message_id: string | null;
};

type MessageRow = {
  body: string;
  company_id: string;
  conversation_id: string;
  customer_id: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  sender_type: "customer" | "agent" | "owner" | "ai" | "system";
  sent_at: string;
};

type ConversationRow = {
  channel_id: string | null;
  company_id: string;
  customer_id: string;
  id: string;
};

type CustomerRow = {
  ai_enabled: boolean;
  company_id: string;
  external_id: string | null;
  id: string;
  name: string;
  platform: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
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

export type RecentConversationMessage = {
  body: string;
  sender_type: MessageRow["sender_type"];
  sent_at: string;
};

export type ProcessMessageResult =
  | {
      reason: "AI disabled for this customer";
      should_reply: false;
    }
  | {
      channel_access_token: string | null;
      channel_id: string | null;
      company_id: string;
      company_name: string;
      conversation_id: string;
      customer_id: string;
      customer_name: string;
      latest_message: string;
      platform: string;
      recent_conversation_history: RecentConversationMessage[];
      should_reply: true;
    };

export type SaveAiReplyResult = {
  conversation_id: string;
  message_id: string;
  success: true;
};

export function isAuthorizedN8nRequest(request: Request) {
  const secret = process.env.TECHSPD_N8N_API_KEY;
  const candidate = request.headers.get("x-techspd-api-key");

  if (!secret || !candidate) {
    return false;
  }

  return safeCompare(candidate, secret);
}

export function parseProcessMessageBody(body: unknown): ProcessMessagePayload {
  const record = requiredRecord(body);

  return {
    conversation_id: requiredUuid(record.conversation_id, "conversation_id"),
    customer_id: requiredUuid(record.customer_id, "customer_id"),
    message_id: requiredUuid(record.message_id, "message_id"),
  };
}

export function parseSaveAiReplyBody(body: unknown): SaveAiReplyPayload {
  const record = requiredRecord(body);

  return {
    ai_message: requiredString(record.ai_message, "ai_message"),
    conversation_id: requiredUuid(record.conversation_id, "conversation_id"),
    customer_id: requiredUuid(record.customer_id, "customer_id"),
    meta_message_id: optionalString(record.meta_message_id),
  };
}

export async function processMessageForN8n(
  payload: ProcessMessagePayload,
): Promise<ProcessMessageResult> {
  const message = await getMessage(payload);
  const [conversation, customer] = await Promise.all([
    getConversation({
      companyId: message.company_id,
      conversationId: payload.conversation_id,
      customerId: payload.customer_id,
    }),
    getCustomer({
      companyId: message.company_id,
      customerId: payload.customer_id,
    }),
  ]);
  const [company, channel, history] = await Promise.all([
    getCompany(message.company_id),
    getChannel({
      channelId: conversation.channel_id,
      companyId: message.company_id,
    }),
    getRecentConversationHistory({
      companyId: message.company_id,
      conversationId: payload.conversation_id,
    }),
  ]);

  if (!customer.ai_enabled) {
    return {
      reason: "AI disabled for this customer",
      should_reply: false,
    };
  }

  return {
    channel_access_token: channel.access_token,
    channel_id: channel.channel_id ?? channel.external_id ?? channel.id,
    company_id: company.id,
    company_name: company.name,
    conversation_id: conversation.id,
    customer_id: customer.id,
    customer_name: customer.name,
    latest_message: message.body,
    platform: channel.platform ?? customer.platform ?? "unknown",
    recent_conversation_history: history,
    should_reply: true,
  };
}

export async function saveAiReply(
  payload: SaveAiReplyPayload,
): Promise<SaveAiReplyResult> {
  const supabase = createAdminClient();
  const conversation = await getConversationById(payload.conversation_id);

  if (conversation.customer_id !== payload.customer_id) {
    throw httpError("Conversation and customer do not match.", 404);
  }

  await getCustomer({
    companyId: conversation.company_id,
    customerId: payload.customer_id,
  });

  const sentAt = new Date().toISOString();
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      body: payload.ai_message,
      company_id: conversation.company_id,
      conversation_id: conversation.id,
      customer_id: payload.customer_id,
      metadata: {
        meta_message_id: payload.meta_message_id,
        source: "n8n_ai_reply",
      },
      sender_type: "ai",
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
      last_message: payload.ai_message,
      last_message_at: sentAt,
      status: "open",
    })
    .eq("id", conversation.id)
    .eq("company_id", conversation.company_id);

  if (updateError) {
    throw httpError(updateError.message, 500);
  }

  return {
    conversation_id: conversation.id,
    message_id: message.id as string,
    success: true,
  };
}

export function n8nAiErrorResponse(error: unknown) {
  if (isHttpError(error)) {
    return {
      body: { error: error.message },
      status: error.status,
    };
  }

  return {
    body: {
      error:
        error instanceof Error ? error.message : "n8n AI integration failed.",
    },
    status: 500,
  };
}

async function getMessage(payload: ProcessMessagePayload) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, company_id, conversation_id, customer_id, sender_type, body, metadata, sent_at")
    .eq("id", payload.message_id)
    .eq("conversation_id", payload.conversation_id)
    .eq("customer_id", payload.customer_id)
    .single();

  if (error || !data) {
    throw httpError("Message was not found.", 404);
  }

  return data as MessageRow;
}

async function getConversation({
  companyId,
  conversationId,
  customerId,
}: {
  companyId: string;
  conversationId: string;
  customerId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, company_id, customer_id, channel_id")
    .eq("id", conversationId)
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .single();

  if (error || !data) {
    throw httpError("Conversation was not found.", 404);
  }

  return data as ConversationRow;
}

async function getConversationById(conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, company_id, customer_id, channel_id")
    .eq("id", conversationId)
    .single();

  if (error || !data) {
    throw httpError("Conversation was not found.", 404);
  }

  return data as ConversationRow;
}

async function getCustomer({
  companyId,
  customerId,
}: {
  companyId: string;
  customerId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_id, external_id, name, platform, ai_enabled")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw httpError("Customer was not found.", 404);
  }

  return data as CustomerRow;
}

async function getCompany(companyId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (error || !data) {
    throw httpError("Company was not found.", 404);
  }

  return data as CompanyRow;
}

async function getChannel({
  channelId,
  companyId,
}: {
  channelId: string | null;
  companyId: string;
}) {
  if (!channelId) {
    throw httpError("Conversation is missing a channel.", 422);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("channels")
    .select("id, company_id, platform, channel_id, channel_name, external_id, access_token")
    .eq("id", channelId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw httpError("Channel was not found.", 404);
  }

  return data as ChannelRow;
}

async function getRecentConversationHistory({
  companyId,
  conversationId,
}: {
  companyId: string;
  conversationId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("sender_type, body, sent_at")
    .eq("company_id", companyId)
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) {
    throw httpError(error.message, 500);
  }

  return ((data ?? []) as RecentConversationMessage[]).reverse();
}

function requiredRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
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
  return trimmed ? trimmed : null;
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

function safeCompare(candidate: string, secret: string) {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
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
