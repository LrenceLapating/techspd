"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AlertCircle,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Laugh,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Paperclip,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type {
  InboxConversation,
  InboxMessage,
  InboxSnapshot,
} from "@/lib/inbox/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const inboxTabs = ["All", "Facebook", "Instagram", "TikTok", "Unread", "AI Off"];
const emptySnapshot: InboxSnapshot = {
  conversations: [],
  messages: [],
  selectedConversationId: null,
};

type RealtimeStatus = "connecting" | "connected" | "error";

type RealtimeMessageRow = {
  body: string;
  company_id: string;
  conversation_id: string;
  created_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  sender_type: "customer" | "agent" | "owner" | "ai" | "system";
  sent_at: string;
};

type RealtimeConversationRow = {
  company_id: string;
  id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type PendingUiLatency = {
  body: string;
  conversationId: string;
  databaseInsertedAt: string;
  messageId: string;
  realtimeReceivedAt: string;
  realtimeReceivedAtMs: number;
  webhookReceivedAt: string | null;
};

export function InboxModule({
  companyId,
  initialSnapshot = emptySnapshot,
}: {
  companyId: string;
  initialSnapshot?: InboxSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialSnapshot.selectedConversationId,
  );
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const [sendError, setSendError] = useState<string | null>(null);
  const conversationsRef = useRef(snapshot.conversations);
  const selectedConversationIdRef = useRef(selectedConversationId);
  const snapshotRequestRef = useRef(0);
  const snapshotAppliedRef = useRef(0);
  const pendingUiLatencyRef = useRef(new Map<string, PendingUiLatency>());
  const applyRealtimeMessageRef = useRef(applyRealtimeMessage);
  const applyRealtimeConversationRef = useRef(applyRealtimeConversation);

  applyRealtimeMessageRef.current = applyRealtimeMessage;
  applyRealtimeConversationRef.current = applyRealtimeConversation;

  useEffect(() => {
    conversationsRef.current = snapshot.conversations;
  }, [snapshot.conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (pendingUiLatencyRef.current.size === 0) {
      return;
    }

    const uiUpdatedAtMs = Date.now();
    const uiUpdatedAt = new Date(uiUpdatedAtMs).toISOString();

    for (const [messageId, timing] of pendingUiLatencyRef.current) {
      const visibleInThread = snapshot.messages.some(
        (message) => message.id === messageId,
      );
      const visibleInPreview = snapshot.conversations.some(
        (conversation) =>
          conversation.id === timing.conversationId &&
          conversation.lastMessage === timing.body,
      );

      if (!visibleInThread && !visibleInPreview) {
        continue;
      }

      const webhookReceivedAtMs = timing.webhookReceivedAt
        ? new Date(timing.webhookReceivedAt).getTime()
        : null;
      const databaseInsertedAtMs = new Date(
        timing.databaseInsertedAt,
      ).getTime();

      console.info("[TechSpd Latency] UI updated", {
        databaseInsertedAt: timing.databaseInsertedAt,
        databaseToRealtimeMs: elapsedMs(
          databaseInsertedAtMs,
          timing.realtimeReceivedAtMs,
        ),
        messageId,
        realtimeReceivedAt: timing.realtimeReceivedAt,
        realtimeToUiMs: elapsedMs(timing.realtimeReceivedAtMs, uiUpdatedAtMs),
        totalLatencyMs:
          webhookReceivedAtMs === null
            ? null
            : elapsedMs(webhookReceivedAtMs, uiUpdatedAtMs),
        uiUpdatedAt,
        webhookReceivedAt: timing.webhookReceivedAt,
        webhookToDatabaseMs:
          webhookReceivedAtMs === null
            ? null
            : elapsedMs(webhookReceivedAtMs, databaseInsertedAtMs),
      });
      pendingUiLatencyRef.current.delete(messageId);
    }
  }, [snapshot]);

  const selectedConversation = useMemo(
    () =>
      snapshot.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ??
      snapshot.conversations[0] ??
      null,
    [selectedConversationId, snapshot.conversations],
  );

  useEffect(() => {
    if (!companyId) {
      setRealtimeStatus("error");
      return;
    }

    const supabase = createClient();
    const channelName = `company-${companyId}-inbox`;
    let isActive = true;
    let channel: RealtimeChannel | null = null;

    async function subscribeToInbox() {
      setRealtimeStatus("connecting");

      const [sessionResult, userResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);
      const session = sessionResult.data.session;
      const user = userResult.data.user;
      const { data: profile, error: profileError } = user
        ? await supabase
            .from("users")
            .select("company_id")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null, error: null };
      const profileCompanyId = (profile as { company_id?: string } | null)
        ?.company_id;

      console.info("[TechSpd Realtime] auth diagnostics", {
        companyId,
        currentUserId: user?.id ?? null,
        profileCompanyId: profileCompanyId ?? null,
        realtimeAuthSessionExists: Boolean(session?.access_token),
        sessionError: sessionResult.error?.message ?? null,
        userError: userResult.error?.message ?? null,
        profileError: profileError?.message ?? null,
        companyMatches: profileCompanyId === companyId,
      });

      if (!isActive) {
        return;
      }

      if (!session?.access_token || !user) {
        console.error("[TechSpd Realtime] authenticated session missing", {
          companyId,
          currentUserId: user?.id ?? null,
          realtimeAuthSessionExists: false,
        });
        setRealtimeStatus("error");
        return;
      }

      if (profileError || profileCompanyId !== companyId) {
        console.error("[TechSpd Realtime] company membership mismatch", {
          companyId,
          currentUserId: user.id,
          profileCompanyId: profileCompanyId ?? null,
        });
        setRealtimeStatus("error");
        return;
      }

      await supabase.realtime.setAuth(session.access_token);

      if (!isActive) {
        return;
      }

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const message = payload.new as RealtimeMessageRow;
            const realtimeReceivedAtMs = Date.now();
            const realtimeReceivedAt = new Date(
              realtimeReceivedAtMs,
            ).toISOString();
            const webhookReceivedAt = metadataTimestamp(
              message.metadata,
              "webhook_received_at",
            );
            const databaseInsertedAtMs = new Date(message.created_at).getTime();
            const webhookReceivedAtMs = webhookReceivedAt
              ? new Date(webhookReceivedAt).getTime()
              : null;

            console.info("[TechSpd Realtime] messages INSERT payload", payload);
            console.info("[TechSpd Realtime] inserted message diagnostics", {
              companyId: message.company_id,
              conversationId: message.conversation_id,
              messageId: message.id,
              senderType: message.sender_type,
            });
            console.info("[TechSpd Latency] realtime payload received", {
              databaseInsertedAt: message.created_at,
              databaseToRealtimeMs: elapsedMs(
                databaseInsertedAtMs,
                realtimeReceivedAtMs,
              ),
              messageId: message.id,
              realtimeReceivedAt,
              webhookReceivedAt,
              webhookToDatabaseMs:
                webhookReceivedAtMs === null
                  ? null
                  : elapsedMs(webhookReceivedAtMs, databaseInsertedAtMs),
              webhookToRealtimeMs:
                webhookReceivedAtMs === null
                  ? null
                  : elapsedMs(webhookReceivedAtMs, realtimeReceivedAtMs),
            });
            applyRealtimeMessageRef.current(message, {
              body: message.body,
              conversationId: message.conversation_id,
              databaseInsertedAt: message.created_at,
              messageId: message.id,
              realtimeReceivedAt,
              realtimeReceivedAtMs,
              webhookReceivedAt,
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
          },
          (payload) => {
            const conversation = payload.new as RealtimeConversationRow;

            console.info(
              "[TechSpd Realtime] conversations UPDATE payload",
              payload,
            );
            applyRealtimeConversationRef.current(conversation);
          },
        )
        .subscribe((status, error) => {
          console.info("[TechSpd Realtime] subscription status", {
            channel: channelName,
            companyId,
            status,
          });

          if (status === "SUBSCRIBED") {
            console.info("[TechSpd Realtime] SUBSCRIBED", {
              channel: channelName,
              companyId,
              currentUserId: user.id,
              realtimeAuthSessionExists: true,
            });
            setRealtimeStatus("connected");
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            console.error(`[TechSpd Realtime] ${status}`, {
              companyId,
              error,
              status,
            });
            setRealtimeStatus("error");
            return;
          }

          setRealtimeStatus("connecting");
        });
    }

    void subscribeToInbox().catch((error) => {
      if (!isActive) {
        return;
      }

      console.error("[TechSpd Realtime] subscription setup failed", {
        companyId,
        error,
      });
      setRealtimeStatus("error");
    });

    return () => {
      isActive = false;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [companyId]);

  function applyRealtimeMessage(
    message: RealtimeMessageRow,
    timing: PendingUiLatency,
  ) {
    if (message.company_id !== companyId) {
      console.warn("[TechSpd Realtime] ignored cross-company message", {
        currentCompanyId: companyId,
        messageCompanyId: message.company_id,
        messageId: message.id,
      });
      return;
    }

    const conversationExists = conversationsRef.current.some(
      (conversation) => conversation.id === message.conversation_id,
    );

    pendingUiLatencyRef.current.set(message.id, timing);

    if (!conversationExists) {
      console.info("[TechSpd Realtime] snapshot recovery required", {
        conversationId: message.conversation_id,
        messageId: message.id,
        reason: "unknown conversation",
      });
      void refreshInboxSnapshot("recovery: unknown conversation");
      return;
    }

    setSnapshot((current) => {
      const messageAlreadyExists = current.messages.some(
        (item) => item.id === message.id,
      );
      const nextConversations = moveConversationToTop(
        current.conversations.map((conversation) =>
          conversation.id === message.conversation_id
            ? {
                ...conversation,
                lastMessage: message.body,
                time: "now",
              }
            : conversation,
        ),
        message.conversation_id,
      );
      const next = {
        ...current,
        conversations: nextConversations,
        messages:
          current.selectedConversationId === message.conversation_id &&
          !messageAlreadyExists
            ? [...current.messages, mapRealtimeMessage(message)]
            : current.messages,
      };

      conversationsRef.current = nextConversations;
      return next;
    });
  }

  function applyRealtimeConversation(conversation: RealtimeConversationRow) {
    if (conversation.company_id !== companyId) {
      return;
    }

    const conversationExists = conversationsRef.current.some(
      (item) => item.id === conversation.id,
    );

    if (!conversationExists) {
      void refreshInboxSnapshot("recovery: unknown conversation update");
      return;
    }

    setSnapshot((current) => {
      const nextConversations = moveConversationToTop(
        current.conversations.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                lastMessage: conversation.last_message ?? item.lastMessage,
                time: conversation.last_message_at ? "now" : item.time,
                unread: conversation.unread_count,
              }
            : item,
        ),
        conversation.id,
      );

      conversationsRef.current = nextConversations;
      return { ...current, conversations: nextConversations };
    });
  }

  async function refreshInboxSnapshot(source: string) {
    const requestId = snapshotRequestRef.current + 1;
    snapshotRequestRef.current = requestId;
    const searchParams = new URLSearchParams();
    const conversationId = selectedConversationIdRef.current;

    if (conversationId) {
      searchParams.set("conversationId", conversationId);
    }

    try {
      const response = await fetch(
        `/api/inbox/snapshot${searchParams.size ? `?${searchParams}` : ""}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      if (!response.ok) {
        console.error("[TechSpd Realtime] snapshot refresh error", {
          status: response.status,
        });
        return;
      }

      const refreshed = (await response.json()) as InboxSnapshot;

      if (requestId < snapshotAppliedRef.current) {
        return;
      }

      snapshotAppliedRef.current = requestId;
      setSnapshot(refreshed);
      setSelectedConversationId(refreshed.selectedConversationId);
      selectedConversationIdRef.current = refreshed.selectedConversationId;

      console.info("[TechSpd Realtime] snapshot refreshed", {
        conversationCount: refreshed.conversations.length,
        facebookConversationCount: refreshed.conversations.filter(
          (conversation) => conversation.platform === "Facebook",
        ).length,
        instagramConversationCount: refreshed.conversations.filter(
          (conversation) => conversation.platform === "Instagram",
        ).length,
        source,
        selectedConversationId: refreshed.selectedConversationId,
      });
    } catch (error) {
      console.error("[TechSpd Realtime] snapshot refresh error", {
        error,
      });
    }
  }

  function openConversation(conversationId: string) {
    selectedConversationIdRef.current = conversationId;
    setSelectedConversationId(conversationId);
    setSnapshot((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, lastReadAt: new Date().toISOString(), unread: 0 }
          : conversation,
      ),
      messages:
        conversationId === current.selectedConversationId ? current.messages : [],
      selectedConversationId: conversationId,
    }));

    void fetchConversationMessages({ companyId, conversationId }).then(
      (messages) => {
        setSnapshot((current) =>
          current.selectedConversationId === conversationId
            ? { ...current, messages }
            : current,
        );
      },
    );
  }

  async function updateCustomerAiEnabled(
    customerId: string,
    aiEnabled: boolean,
  ) {
    const previousAiEnabled =
      conversationsRef.current.find(
        (conversation) => conversation.customer.id === customerId,
      )?.aiEnabled ?? !aiEnabled;
    const applyValue = (value: boolean) => {
      setSnapshot((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.customer.id === customerId
            ? { ...conversation, aiEnabled: value }
            : conversation,
        ),
      }));
    };

    applyValue(aiEnabled);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ ai_enabled: aiEnabled })
      .eq("company_id", companyId)
      .eq("id", customerId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      applyValue(previousAiEnabled);
      throw new Error(error?.message ?? "AI reply preference was not saved.");
    }
  }

  function addOptimisticMessage(
    conversationId: string,
    message: InboxMessage,
  ) {
    setSnapshot((current) => ({
      ...current,
      conversations: moveConversationToTop(
        current.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                lastMessage: message.body,
                time: "now",
              }
            : conversation,
        ),
        conversationId,
      ),
      messages:
        current.selectedConversationId === conversationId
          ? [...current.messages, message]
          : current.messages,
    }));
  }

  function confirmOptimisticMessage(
    optimisticId: string,
    persistedId: string,
  ) {
    setSnapshot((current) => {
      const persistedAlreadyExists = current.messages.some(
        (message) => message.id === persistedId,
      );

      return {
        ...current,
        messages: persistedAlreadyExists
          ? current.messages.filter((message) => message.id !== optimisticId)
          : current.messages.map((message) =>
              message.id === optimisticId
                ? { ...message, id: persistedId, status: "sent" }
                : message,
            ),
      };
    });
  }

  function failOptimisticMessage(optimisticId: string) {
    setSnapshot((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === optimisticId ? { ...message, status: "failed" } : message,
      ),
    }));
  }

  return (
    <section className="grid h-full min-h-0 grid-flow-col auto-cols-[min(92vw,420px)] gap-3 overflow-x-auto overscroll-x-contain pb-1 xl:grid-flow-row xl:auto-cols-auto xl:grid-cols-[300px_minmax(0,1fr)_320px] xl:overflow-hidden xl:pb-0">
      <ConversationList
        conversations={snapshot.conversations}
        onSelect={openConversation}
        realtimeStatus={realtimeStatus}
        selectedConversationId={selectedConversation?.id ?? null}
      />
      <ChatPanel
        conversation={selectedConversation}
        messages={snapshot.messages}
        onMessageFailed={failOptimisticMessage}
        onMessagePending={addOptimisticMessage}
        onMessageSent={(optimisticId, persistedId) => {
          confirmOptimisticMessage(optimisticId, persistedId);
          setSendError(null);
        }}
        onSendError={setSendError}
        sendError={sendError}
      />
      <CustomerPanel
        conversation={selectedConversation}
        onAiEnabledChange={updateCustomerAiEnabled}
      />
    </section>
  );
}

function ConversationList({
  conversations,
  onSelect,
  realtimeStatus,
  selectedConversationId,
}: {
  conversations: InboxConversation[];
  onSelect: (conversationId: string) => void;
  realtimeStatus: RealtimeStatus;
  selectedConversationId: string | null;
}) {
  return (
    <Card aria-label="Conversation list" className="h-full min-h-0 overflow-hidden shadow-sm">
      <CardContent className="flex h-full min-h-0 flex-col p-0">
        <div className="shrink-0 border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Unified inbox</h3>
              <p className="text-sm text-muted-foreground">
                Conversations across every connected channel.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge variant="secondary">{conversations.length} open</Badge>
              <RealtimeBadge status={realtimeStatus} />
            </div>
          </div>

          <form className="relative mt-4" role="search">
            <label htmlFor="conversation-search" className="sr-only">
              Search conversations
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="conversation-search"
              name="conversationSearch"
              placeholder="Search inbox"
              type="search"
              className="pl-9"
            />
          </form>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {inboxTabs.map((tab, index) => (
              <button
                key={tab}
                className={cn(
                  "h-8 shrink-0 rounded-lg border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  index === 0 &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <ConversationCard
                conversation={conversation}
                isActive={conversation.id === selectedConversationId}
                key={conversation.id}
                onSelect={onSelect}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
              No conversations yet. New social messages will appear here in
              realtime once your channels are connected.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationCard({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: InboxConversation;
  isActive: boolean;
  onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-xl border bg-background/80 p-3 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-card",
        isActive && "border-primary bg-card ring-2 ring-primary/10",
      )}
      onClick={() => onSelect(conversation.id)}
      type="button"
    >
      <div className="flex items-start gap-3">
        <CustomerAvatar conversation={conversation} size="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">
              {conversation.customer.name}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {conversation.time}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PlatformBadge platform={conversation.platform} />
            <Badge variant={conversation.aiEnabled ? "success" : "secondary"}>
              {conversation.aiEnabled ? "AI Enabled" : "Human Mode"}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {conversation.lastMessage}
          </p>
        </div>
        {conversation.unread > 0 ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {conversation.unread}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ChatPanel({
  conversation,
  messages,
  onMessageFailed,
  onMessagePending,
  onMessageSent,
  onSendError,
  sendError,
}: {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  onMessageFailed: (optimisticId: string) => void;
  onMessagePending: (conversationId: string, message: InboxMessage) => void;
  onMessageSent: (optimisticId: string, persistedId: string) => void;
  onSendError: (message: string | null) => void;
  sendError: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showLatestMessage, setShowLatestMessage] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const conversationChanged =
      previousConversationIdRef.current !== (conversation?.id ?? null);
    const lastMessageId = messages.at(-1)?.id ?? null;
    const messageChanged = previousLastMessageIdRef.current !== lastMessageId;

    previousConversationIdRef.current = conversation?.id ?? null;
    previousLastMessageIdRef.current = lastMessageId;

    if (conversationChanged) {
      isNearBottomRef.current = true;
      setShowLatestMessage(false);
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      return;
    }

    if (!messageChanged) {
      return;
    }

    if (isNearBottomRef.current) {
      setShowLatestMessage(false);
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    } else {
      setShowLatestMessage(true);
    }
  }, [conversation?.id, messages]);

  if (!conversation) {
    return (
      <Card className="h-full min-h-0 overflow-hidden shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <MessageSquareText className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold">No conversations yet</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              When a customer sends a Facebook, Instagram, or TikTok message,
              the live chat thread will open here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trimmedDraft = draft.trim();

  async function sendManualReply() {
    if (!conversation || !trimmedDraft || isSending) {
      return;
    }

    setIsSending(true);
    onSendError(null);
    const messageBody = trimmedDraft;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;

    setDraft("");
    onMessagePending(conversation.id, {
      body: messageBody,
      id: optimisticId,
      sender: "owner",
      status: "sending",
      time: "now",
    });

    try {
      const response = await fetch("/api/messages/send", {
        body: JSON.stringify({
          conversation_id: conversation.id,
          customer_id: conversation.customer.id,
          message: messageBody,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message_id?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Manual reply failed.");
      }

      onMessageSent(optimisticId, payload.message_id ?? optimisticId);
    } catch (error) {
      onMessageFailed(optimisticId);
      setDraft(messageBody);
      onSendError(
        error instanceof Error ? error.message : "Manual reply failed.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden shadow-sm">
      <CardContent className="flex h-full min-h-0 flex-col p-0">
        <div className="z-10 shrink-0 border-b bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CustomerAvatar conversation={conversation} size="size-11" />
              <div className="min-w-0">
                <h3 className="truncate font-semibold">
                  {conversation.customer.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PlatformBadge platform={conversation.platform} />
                  <Badge variant="outline">{conversation.leadStage}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline">
                <Tag className="size-4" />
                Mark Lead
              </Button>
              <Button size="sm" variant="outline">
                <CheckCircle2 className="size-4" />
                Mark Converted
              </Button>
              <Button size="sm" variant="outline">
                <FileText className="size-4" />
                Add Note
              </Button>
            </div>
          </div>

          {!conversation.aiEnabled ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-medium text-[#9a3412]">
              <ShieldAlert className="size-4" />
              Human Mode Active - AI will not reply
            </div>
          ) : null}
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            className="h-full space-y-2 overflow-y-auto overscroll-contain bg-secondary/30 p-4"
            onScroll={(event) => {
              const viewport = event.currentTarget;
              const distanceFromBottom =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
              const isNearBottom = distanceFromBottom < 120;

              isNearBottomRef.current = isNearBottom;
              if (isNearBottom) {
                setShowLatestMessage(false);
              }
            }}
            ref={messagesViewportRef}
          >
            {messages.length > 0 ? (
              messages.map((message) => (
                <ChatBubble message={message} key={message.id} />
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                No messages yet for this customer.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showLatestMessage ? (
            <Button
              className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
                isNearBottomRef.current = true;
                setShowLatestMessage(false);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Latest message
            </Button>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              Owner can always manually reply
            </span>
            <span className="hidden sm:inline">/</span>
            <span>
              AI auto reply is{" "}
              {conversation.aiEnabled ? "enabled" : "disabled"} for this
              customer.
            </span>
          </div>
          {sendError ? (
            <p className="mb-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#991b1b]">
              {sendError}
            </p>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendManualReply();
            }}
          >
            <Button aria-label="Attach file" size="icon" type="button" variant="outline">
              <Paperclip className="size-4" />
            </Button>
            <Button aria-label="Add emoji" size="icon" type="button" variant="outline">
              <Laugh className="size-4" />
            </Button>
            <label htmlFor="message-composer" className="sr-only">
              Message composer
            </label>
            <textarea
              className="min-h-10 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              id="message-composer"
              name="messageComposer"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendManualReply();
                }
              }}
              placeholder="Write a manual reply..."
              rows={1}
              value={draft}
            />
            <Button
              className="min-w-32"
              disabled={!trimmedDraft || isSending}
              type="submit"
            >
              {isSending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {isSending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatBubble({ message }: { message: InboxMessage }) {
  const isOwner = message.sender === "owner";
  const isAi = message.sender === "ai";

  return (
    <div className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl border px-3 py-2 shadow-sm",
          isOwner && "bg-primary text-primary-foreground",
          isAi && "bg-accent text-accent-foreground",
          message.sender === "customer" && "bg-card text-card-foreground",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs font-medium opacity-80">
          {isAi ? <Bot className="size-3.5" /> : null}
          {isOwner ? <UserRound className="size-3.5" /> : null}
          {message.sender === "customer" ? (
            <MessageSquareText className="size-3.5" />
          ) : null}
          <span>
            {message.sender === "customer"
              ? "Customer"
              : message.sender === "ai"
                ? "AI reply"
                : "Owner"}
          </span>
          <span>{message.time}</span>
        </div>
        <p className="text-sm leading-5">{message.body}</p>
        {message.sender !== "customer" && message.status ? (
          <div
            className={cn(
              "mt-1.5 flex items-center justify-end gap-1 text-[11px] opacity-75",
              message.status === "failed" && "text-[#fecaca] opacity-100",
            )}
          >
            {message.status === "sending" ? (
              <Clock3 className="size-3" />
            ) : message.status === "failed" ? (
              <AlertCircle className="size-3" />
            ) : (
              <Check className="size-3" />
            )}
            <span className="capitalize">{message.status}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerPanel({
  conversation,
  onAiEnabledChange,
}: {
  conversation: InboxConversation | null;
  onAiEnabledChange: (customerId: string, enabled: boolean) => Promise<void>;
}) {
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiSaveError, setAiSaveError] = useState<string | null>(null);

  useEffect(() => {
    setAiSaveError(null);
    setIsSavingAi(false);
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <Card className="h-full min-h-0 overflow-hidden shadow-sm">
        <CardContent className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          No customer record yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden shadow-sm">
      <CardContent className="h-full space-y-5 overflow-y-auto overscroll-contain p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer record
          </p>
          <div className="mt-3 flex items-center gap-3">
            <CustomerAvatar conversation={conversation} size="size-12" />
            <div className="min-w-0">
              <h3 className="truncate font-semibold">
                {conversation.customer.name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <PlatformBadge platform={conversation.platform} />
                <Badge variant={conversation.aiEnabled ? "success" : "secondary"}>
                  {conversation.aiEnabled ? "AI Enabled" : "Human Mode"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <CustomerField icon={Phone} label="Phone" value={conversation.customer.phone} />
          <CustomerField
            icon={MessageSquareText}
            label="Email"
            value={conversation.customer.email}
          />
          <CustomerField
            icon={MapPin}
            label="Location"
            value={conversation.customer.location}
          />
          <CustomerField
            icon={Clock3}
            label="Platform"
            value={conversation.platform}
          />
        </div>

        <Separator />

        <div>
          <p className="text-sm font-semibold">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {conversation.customer.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Notes</p>
          <div className="mt-2 space-y-2">
            {conversation.customer.notes.map((note) => (
              <p
                className="rounded-lg border bg-background/72 p-3 text-sm leading-6 text-muted-foreground"
                key={note}
              >
                {note}
              </p>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <label className="text-sm font-semibold" htmlFor="lead-stage">
            Lead stage
          </label>
          <select
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={conversation.leadStage}
            id="lead-stage"
            name="leadStage"
          >
            {["New", "Interested", "Follow Up", "Converted", "Lost"].map(
              (stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="space-y-3 rounded-lg border bg-background/72 p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">AI Auto Reply</p>
                <Badge
                  variant={conversation.aiEnabled ? "success" : "secondary"}
                >
                  {conversation.aiEnabled ? "AI Enabled" : "Human Mode"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {conversation.aiEnabled
                  ? "AI replies enabled"
                  : "Human mode active"}
              </p>
            </div>
            <button
              aria-checked={conversation.aiEnabled}
              aria-label="AI Auto Reply"
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
                conversation.aiEnabled ? "bg-[#16a34a]" : "bg-[#9ca3af]",
              )}
              disabled={isSavingAi}
              onClick={async () => {
                setIsSavingAi(true);
                setAiSaveError(null);

                try {
                  await onAiEnabledChange(
                    conversation.customer.id,
                    !conversation.aiEnabled,
                  );
                } catch (error) {
                  setAiSaveError(
                    error instanceof Error
                      ? error.message
                      : "AI reply preference was not saved.",
                  );
                } finally {
                  setIsSavingAi(false);
                }
              }}
              role="switch"
              type="button"
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                  conversation.aiEnabled && "translate-x-5",
                )}
              />
            </button>
          </div>
          {aiSaveError ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {aiSaveError}
            </p>
          ) : null}
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span>Conversion</span>
            <input
              aria-label="Conversion checkbox"
              className="size-5 accent-primary"
              defaultChecked={conversation.leadStage === "Converted"}
              name="conversion"
              type="checkbox"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: InboxConversation["platform"] }) {
  const Icon =
    platform === "Facebook"
      ? MessageSquareText
      : platform === "Instagram"
        ? Camera
        : Sparkles;

  return (
    <Badge
      className={cn(
        "gap-1.5",
        platform === "Facebook" && "bg-[#eff6ff] text-[#1d4ed8]",
        platform === "Instagram" && "bg-[#fdf2f8] text-[#be185d]",
        platform === "TikTok" && "bg-[#f5f3ff] text-[#6d28d9]",
        platform === "Unknown" && "bg-secondary text-muted-foreground",
      )}
      variant="secondary"
    >
      <Icon className="size-3.5" />
      {platform}
    </Badge>
  );
}

function CustomerAvatar({
  conversation,
  size,
}: {
  conversation: InboxConversation;
  size: "size-11" | "size-12";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [conversation.avatarUrl]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary font-semibold text-primary-foreground",
        size,
        size === "size-12" ? "text-base" : "text-sm",
      )}
    >
      {conversation.avatarUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${conversation.customer.name} profile`}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          src={conversation.avatarUrl}
        />
      ) : (
        conversation.avatar || "?"
      )}
    </div>
  );
}

async function fetchConversationMessages({
  companyId,
  conversationId,
}: {
  companyId: string;
  conversationId: string;
}) {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, company_id, conversation_id, sender_type, body, sent_at")
    .eq("company_id", companyId)
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(100);

  return ((data ?? []) as RealtimeMessageRow[]).map(mapRealtimeMessage);
}

function mapRealtimeMessage(message: RealtimeMessageRow): InboxMessage {
  return {
    body: message.body,
    id: message.id,
    sender:
      message.sender_type === "customer"
        ? "customer"
        : message.sender_type === "agent" || message.sender_type === "owner"
          ? "owner"
          : "ai",
    status: message.sender_type === "customer" ? undefined : "sent",
    time: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(message.sent_at)),
  };
}

function moveConversationToTop(
  conversations: InboxConversation[],
  conversationId: string,
) {
  const conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    return conversations;
  }

  return [
    conversation,
    ...conversations.filter((item) => item.id !== conversationId),
  ];
}

function metadataTimestamp(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];

  if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime())) {
    return null;
  }

  return value;
}

function elapsedMs(startMs: number, endMs: number) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  return Math.max(0, Math.round(endMs - startMs));
}

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const isConnected = status === "connected";
  const Icon = isConnected ? Wifi : WifiOff;

  return (
    <Badge
      className={cn(
        "gap-1.5",
        isConnected && "bg-[#ecfdf5] text-[#047857]",
        status === "connecting" && "bg-[#fffbeb] text-[#b45309]",
        status === "error" && "bg-[#fef2f2] text-[#b91c1c]",
      )}
      variant="secondary"
    >
      <Icon className="size-3.5" />
      Realtime: {isConnected ? "Connected" : status === "connecting" ? "Connecting" : "Error"}
    </Badge>
  );
}
