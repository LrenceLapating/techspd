import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { formatLeadStage, formatPlatform } from "@/lib/sales/data";

export type InboxConversation = {
  aiEnabled: boolean;
  avatar: string;
  customer: {
    email: string;
    id: string;
    location: string;
    name: string;
    notes: string[];
    phone: string;
    tags: string[];
  };
  id: string;
  lastMessage: string;
  leadStage: string;
  platform: "Facebook" | "Instagram" | "TikTok" | "Unknown";
  time: string;
  unread: number;
};

export type InboxMessage = {
  body: string;
  id: string;
  sender: "customer" | "ai" | "owner";
  time: string;
};

export type InboxSnapshot = {
  conversations: InboxConversation[];
  messages: InboxMessage[];
  selectedConversationId: string | null;
};

type ConversationRow = {
  channel_id: string | null;
  channels:
    | {
        name: string | null;
        type: string | null;
      }
    | {
        name: string | null;
        type: string | null;
      }[]
    | null;
  customer_id: string;
  customers:
    | {
        ai_enabled: boolean;
        email: string | null;
        lead_stage: string | null;
        location: string | null;
        metadata: Record<string, unknown> | null;
        name: string;
        phone: string | null;
        platform: string | null;
      }
    | {
        ai_enabled: boolean;
        email: string | null;
        lead_stage: string | null;
        location: string | null;
        metadata: Record<string, unknown> | null;
        name: string;
        phone: string | null;
        platform: string | null;
      }[]
    | null;
  id: string;
  last_message_at: string | null;
  updated_at: string;
};

type MessageRow = {
  body: string;
  conversation_id: string;
  id: string;
  sender_type: "customer" | "agent" | "owner" | "ai" | "system";
  sent_at: string;
};

export async function getInboxSnapshot({
  companyId,
  selectedConversationId: requestedSelectedConversationId,
  supabaseClient,
}: {
  companyId: string;
  selectedConversationId?: string | null;
  supabaseClient?: SupabaseClient;
}): Promise<InboxSnapshot> {
  const supabase = supabaseClient ?? (await createClient());

  const { data: conversationsData, error: conversationsError } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, channel_id, last_message_at, updated_at, customers(name,email,phone,location,platform,ai_enabled,lead_stage,metadata), channels(name,type)",
    )
    .eq("company_id", companyId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(30);

  if (conversationsError) {
    return {
      conversations: [],
      messages: [],
      selectedConversationId: null,
    };
  }

  const conversationRows = (conversationsData ?? []) as ConversationRow[];
  const conversationIds = conversationRows.map((conversation) => conversation.id);
  const selectedConversationId =
    requestedSelectedConversationId &&
    conversationIds.includes(requestedSelectedConversationId)
      ? requestedSelectedConversationId
      : conversationIds[0] ?? null;

  const latestMessages = await getLatestMessagesByConversation(
    supabase,
    companyId,
    conversationIds,
  );
  const selectedMessages = selectedConversationId
    ? await getConversationMessages(supabase, companyId, selectedConversationId)
    : [];

  return {
    conversations: conversationRows.map((conversation) =>
      mapConversation(conversation, latestMessages.get(conversation.id)),
    ),
    messages: selectedMessages,
    selectedConversationId,
  };
}

async function getLatestMessagesByConversation(
  supabase: SupabaseClient,
  companyId: string,
  conversationIds: string[],
) {
  const latestMessages = new Map<string, MessageRow>();

  if (conversationIds.length === 0) {
    return latestMessages;
  }

  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, body, sent_at")
    .eq("company_id", companyId)
    .in("conversation_id", conversationIds)
    .order("sent_at", { ascending: false })
    .limit(150);

  for (const message of ((data ?? []) as MessageRow[])) {
    if (!latestMessages.has(message.conversation_id)) {
      latestMessages.set(message.conversation_id, message);
    }
  }

  return latestMessages;
}

async function getConversationMessages(
  supabase: SupabaseClient,
  companyId: string,
  conversationId: string,
) {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, body, sent_at")
    .eq("company_id", companyId)
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(100);

  return ((data ?? []) as MessageRow[]).map(mapMessage);
}

function mapConversation(
  conversation: ConversationRow,
  latestMessage?: MessageRow,
): InboxConversation {
  const customer = Array.isArray(conversation.customers)
    ? conversation.customers[0]
    : conversation.customers;
  const channel = Array.isArray(conversation.channels)
    ? conversation.channels[0]
    : conversation.channels;
  const platform = platformLabel(customer?.platform ?? channel?.name ?? channel?.type);
  const name = customer?.name ?? "Unknown customer";

  return {
    aiEnabled: customer?.ai_enabled ?? true,
    avatar: initials(name),
    customer: {
      email: customer?.email ?? "No email yet",
      id: conversation.customer_id,
      location: customer?.location ?? "Location unavailable",
      name,
      notes: metadataNotes(customer?.metadata),
      phone: customer?.phone ?? "No phone yet",
      tags: [platform],
    },
    id: conversation.id,
    lastMessage: latestMessage?.body ?? "No messages yet",
    leadStage: formatLeadStage(customer?.lead_stage ?? "new"),
    platform,
    time: relativeTime(latestMessage?.sent_at ?? conversation.last_message_at),
    unread: latestMessage?.sender_type === "customer" ? 1 : 0,
  };
}

function mapMessage(message: MessageRow): InboxMessage {
  return {
    body: message.body,
    id: message.id,
    sender:
      message.sender_type === "customer"
        ? "customer"
        : message.sender_type === "agent" || message.sender_type === "owner"
          ? "owner"
          : "ai",
    time: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(message.sent_at)),
  };
}

function platformLabel(value?: string | null) {
  const normalized = (value ?? "unknown").toLowerCase();

  if (normalized.includes("facebook")) {
    return "Facebook";
  }

  if (normalized.includes("instagram")) {
    return "Instagram";
  }

  if (normalized.includes("tiktok") || normalized.includes("tik tok")) {
    return "TikTok";
  }

  return formatPlatform(normalized || "unknown") as InboxConversation["platform"];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function metadataNotes(metadata: Record<string, unknown> | null | undefined) {
  const note = metadata?.notes ?? metadata?.conversion_notes;

  if (typeof note === "string" && note.trim()) {
    return [note];
  }

  return ["No notes yet."];
}

function relativeTime(value?: string | null) {
  if (!value) {
    return "--";
  }

  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(Math.floor(diff / 60000), 0);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}
