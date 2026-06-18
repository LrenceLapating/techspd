"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowDown,
  Bell,
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

type RealtimeStatus = "connecting" | "live" | "offline";

type RealtimeMessageRow = {
  body: string;
  company_id: string;
  conversation_id: string;
  id: string;
  sender_type: "customer" | "agent" | "owner" | "ai" | "system";
  sent_at: string;
};

type RealtimeConversationRow = {
  channel_id: string | null;
  company_id: string;
  customer_id: string;
  id: string;
  last_message_at: string | null;
  last_read_at: string | null;
  unread_count: number;
  updated_at: string;
};

type TypingPayload = {
  actor: "customer" | "owner";
  companyId: string;
  conversationId: string;
  isTyping: boolean;
};

type NotificationPermissionState = NotificationPermission | "unsupported";

type ClientConversationRow = RealtimeConversationRow & {
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
  customers:
    | {
        ai_enabled: boolean;
        avatar_url: string | null;
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
        avatar_url: string | null;
        email: string | null;
        lead_stage: string | null;
        location: string | null;
        metadata: Record<string, unknown> | null;
        name: string;
        phone: string | null;
        platform: string | null;
      }[]
    | null;
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
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, boolean>
  >({});
  const selectedConversationIdRef = useRef(selectedConversationId);
  const conversationsRef = useRef(snapshot.conversations);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationsRef.current = snapshot.conversations;
  }, [snapshot.conversations]);

  useEffect(() => {
    setNotificationPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
  }, []);

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
      setRealtimeStatus("offline");
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel | null = supabase
      .channel(`company-${companyId}-inbox-realtime`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as TypingPayload;

        if (
          typing.companyId !== companyId ||
          typing.actor !== "customer" ||
          !typing.conversationId
        ) {
          return;
        }

        const existingTimeout = typingTimeoutsRef.current[typing.conversationId];
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        setTypingByConversation((current) => ({
          ...current,
          [typing.conversationId]: typing.isTyping,
        }));

        if (typing.isTyping) {
          typingTimeoutsRef.current[typing.conversationId] = setTimeout(() => {
            setTypingByConversation((current) => ({
              ...current,
              [typing.conversationId]: false,
            }));
          }, 4_000);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `company_id=eq.${companyId}`,
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const message = payload.new as RealtimeMessageRow;

          applyRealtimeMessage(message);
          const knownConversation = conversationsRef.current.find(
            (conversation) => conversation.id === message.conversation_id,
          );

          if (message.sender_type === "customer") {
            if (knownConversation) {
              notifyCustomerMessage(message, knownConversation);
            } else {
              playNotificationSound();
            }

            if (selectedConversationIdRef.current === message.conversation_id) {
              void markConversationRead(message.conversation_id);
            }
          }

          if (!knownConversation) {
            const conversation = await fetchConversationPreview({
              companyId,
              conversationId: message.conversation_id,
              latestMessage: message,
            });

            if (conversation) {
              upsertConversation(conversation);
              if (message.sender_type === "customer") {
                showDesktopNotification(message, conversation);
              }
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `company_id=eq.${companyId}`,
          schema: "public",
          table: "conversations",
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            return;
          }

          const conversationRow = payload.new as RealtimeConversationRow;
          const conversation = await fetchConversationPreview({
            companyId,
            conversationId: conversationRow.id,
            latestMessage: null,
          });

          if (conversation) {
            upsertConversation(conversation);
          }
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(status === "SUBSCRIBED" ? "live" : "connecting");
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      realtimeChannelRef.current = null;
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
    };
    // Subscription callbacks intentionally read the latest selection from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (selectedConversationId) {
      void markConversationRead(selectedConversationId);
    }
    // markConversationRead is scoped to the active company for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedConversationId]);

  function applyRealtimeMessage(message: RealtimeMessageRow) {
    setSnapshot((current) => {
      const isOpen = selectedConversationIdRef.current === message.conversation_id;
      const nextMessage = mapRealtimeMessage(message);
      const shouldAppend =
        isOpen &&
        !current.messages.some((existing) => existing.id === nextMessage.id);
      const nextConversations = moveConversationToTop(
        current.conversations.map((conversation) => {
          if (conversation.id !== message.conversation_id) {
            return conversation;
          }

          return {
            ...conversation,
            lastMessage: message.body,
            time: relativeTime(message.sent_at),
            unread:
              isOpen
                ? 0
                : message.sender_type !== "customer"
                  ? conversation.unread
                : conversation.unread + 1,
          };
        }),
        message.conversation_id,
      );

      return {
        ...current,
        conversations: nextConversations,
        messages: shouldAppend
          ? [...current.messages, nextMessage]
          : current.messages,
      };
    });
  }

  async function markConversationRead(conversationId: string) {
    const readAt = new Date().toISOString();

    setSnapshot((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, lastReadAt: readAt, unread: 0 }
          : conversation,
      ),
    }));

    const supabase = createClient();
    await supabase
      .from("conversations")
      .update({ last_read_at: readAt, unread_count: 0 })
      .eq("company_id", companyId)
      .eq("id", conversationId);
  }

  function playNotificationSound() {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        920,
        context.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.22);
    } catch {
      // Browsers can block audio until the user grants notification permission.
    }
  }

  function showDesktopNotification(
    message: RealtimeMessageRow,
    conversation?: InboxConversation,
  ) {
    if (
      message.sender_type !== "customer" ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      (document.visibilityState === "visible" &&
        selectedConversationIdRef.current === message.conversation_id)
    ) {
      return;
    }

    const notification = new Notification(
      conversation?.customer.name ?? "New customer message",
      {
        body: message.body,
        tag: `techspd-conversation-${message.conversation_id}`,
      },
    );
    notification.onclick = () => {
      window.focus();
      openConversation(message.conversation_id);
      notification.close();
    };
  }

  function notifyCustomerMessage(
    message: RealtimeMessageRow,
    conversation?: InboxConversation,
  ) {
    playNotificationSound();
    showDesktopNotification(message, conversation);
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      playNotificationSound();
    }
  }

  function broadcastOwnerTyping(conversationId: string, isTyping: boolean) {
    void realtimeChannelRef.current?.send({
      event: "typing",
      payload: {
        actor: "owner",
        companyId,
        conversationId,
        isTyping,
      } satisfies TypingPayload,
      type: "broadcast",
    });
  }

  function openConversation(conversationId: string) {
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

  function upsertConversation(conversation: InboxConversation) {
    setSnapshot((current) => {
      const currentConversation = current.conversations.find(
        (item) => item.id === conversation.id,
      );
      const isOpen = selectedConversationIdRef.current === conversation.id;
      const unread =
        currentConversation && !isOpen
          ? Math.max(currentConversation.unread, conversation.unread)
          : isOpen
            ? 0
            : conversation.unread;
      const withoutConversation = current.conversations.filter(
        (item) => item.id !== conversation.id,
      );

      return {
        ...current,
        conversations: [
          {
            ...(currentConversation ?? conversation),
            ...conversation,
            lastMessage:
              conversation.lastMessage === "No messages yet" && currentConversation
                ? currentConversation.lastMessage
                : conversation.lastMessage,
            time:
              conversation.time === "--" && currentConversation
                ? currentConversation.time
                : conversation.time,
            unread,
          },
          ...withoutConversation,
        ],
        selectedConversationId:
          current.selectedConversationId ?? conversation.id,
      };
    });

    setSelectedConversationId((current) => current ?? conversation.id);
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
    <section className="grid min-h-[calc(100vh-172px)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <ConversationList
        conversations={snapshot.conversations}
        notificationPermission={notificationPermission}
        onEnableNotifications={requestNotificationPermission}
        onSelect={openConversation}
        realtimeStatus={realtimeStatus}
        selectedConversationId={selectedConversation?.id ?? null}
      />
      <ChatPanel
        conversation={selectedConversation}
        messages={snapshot.messages}
        isCustomerTyping={
          selectedConversation ? typingByConversation[selectedConversation.id] : false
        }
        onMessageFailed={failOptimisticMessage}
        onMessagePending={addOptimisticMessage}
        onMessageSent={(optimisticId, persistedId) => {
          confirmOptimisticMessage(optimisticId, persistedId);
          setSendError(null);
        }}
        onSendError={setSendError}
        onTypingChange={broadcastOwnerTyping}
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
  notificationPermission,
  onEnableNotifications,
  onSelect,
  realtimeStatus,
  selectedConversationId,
}: {
  conversations: InboxConversation[];
  notificationPermission: NotificationPermissionState;
  onEnableNotifications: () => Promise<void>;
  onSelect: (conversationId: string) => void;
  realtimeStatus: RealtimeStatus;
  selectedConversationId: string | null;
}) {
  return (
    <Card aria-label="Conversation list" className="overflow-hidden shadow-sm">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b p-4">
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

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {notificationPermission === "default" ? (
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[#1e3a8a]">
              <Bell className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Never miss a reply</p>
                <p className="mt-1 text-xs leading-5 text-[#1e40af]">
                  Enable desktop alerts and a short sound for new customer messages.
                </p>
              </div>
              <Button
                className="shrink-0"
                onClick={() => void onEnableNotifications()}
                size="sm"
                type="button"
                variant="outline"
              >
                Enable
              </Button>
            </div>
          ) : notificationPermission === "denied" ? (
            <p className="mb-3 rounded-lg border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              Desktop notifications are blocked in your browser settings.
            </p>
          ) : null}
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
  isCustomerTyping,
  messages,
  onMessageFailed,
  onMessagePending,
  onMessageSent,
  onSendError,
  onTypingChange,
  sendError,
}: {
  conversation: InboxConversation | null;
  isCustomerTyping: boolean;
  messages: InboxMessage[];
  onMessageFailed: (optimisticId: string) => void;
  onMessagePending: (conversationId: string, message: InboxMessage) => void;
  onMessageSent: (optimisticId: string, persistedId: string) => void;
  onSendError: (message: string | null) => void;
  onTypingChange: (conversationId: string, isTyping: boolean) => void;
  sendError: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const previousConversationIdRef = useRef<string | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const conversationChanged = previousConversationIdRef.current !== conversation?.id;
    previousConversationIdRef.current = conversation?.id ?? null;

    if (conversationChanged || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: conversationChanged ? "auto" : "smooth",
        block: "end",
      });
      isNearBottomRef.current = true;
      setShowJumpToLatest(false);
    } else if (messages.length > 0) {
      setShowJumpToLatest(true);
    }
  }, [conversation?.id, messages.length]);

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
    };
  }, []);

  if (!conversation) {
    return (
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="flex h-full min-h-[560px] items-center justify-center p-6">
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
    onTypingChange(conversation.id, false);
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
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b p-4">
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

        <div
          className="relative flex-1 space-y-4 overflow-y-auto bg-secondary/30 p-4"
          onScroll={(event) => {
            const viewport = event.currentTarget;
            const distanceFromBottom =
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            isNearBottomRef.current = distanceFromBottom < 120;
            if (isNearBottomRef.current) {
              setShowJumpToLatest(false);
            }
          }}
          ref={messagesViewportRef}
        >
          {messages.length > 0 ? (
            messages.map((message) => (
              <ChatBubble message={message} key={message.id} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              No messages yet for this customer.
            </div>
          )}
          {isCustomerTyping ? (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
                    key={dot}
                    style={{ animationDelay: `${dot * 140}ms` }}
                  />
                ))}
              </span>
              Customer is typing
            </div>
          ) : null}
          <div ref={messagesEndRef} />
          {showJumpToLatest ? (
            <Button
              aria-label="Jump to latest message"
              className="sticky bottom-0 left-1/2 -translate-x-1/2 shadow-md"
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                isNearBottomRef.current = true;
                setShowJumpToLatest(false);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <ArrowDown className="size-4" />
              Latest
            </Button>
          ) : null}
        </div>

        <div className="border-t bg-card p-4">
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
              onChange={(event) => {
                const nextDraft = event.target.value;
                setDraft(nextDraft);
                onTypingChange(conversation.id, nextDraft.trim().length > 0);

                if (typingStopTimeoutRef.current) {
                  clearTimeout(typingStopTimeoutRef.current);
                }
                typingStopTimeoutRef.current = setTimeout(
                  () => onTypingChange(conversation.id, false),
                  1_200,
                );
              }}
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
          "max-w-[82%] rounded-2xl border px-4 py-3 shadow-sm",
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
        <p className="text-sm leading-6">{message.body}</p>
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
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="flex h-full min-h-[560px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          No customer record yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="h-full space-y-5 p-4">
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

async function fetchConversationPreview({
  companyId,
  conversationId,
  latestMessage,
}: {
  companyId: string;
  conversationId: string;
  latestMessage: RealtimeMessageRow | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, company_id, customer_id, channel_id, last_message_at, last_read_at, unread_count, updated_at, customers(name,avatar_url,email,phone,location,platform,ai_enabled,lead_stage,metadata), channels(name,type)",
    )
    .eq("company_id", companyId)
    .eq("id", conversationId)
    .single();

  if (error || !data) {
    return null;
  }

  let resolvedLatestMessage = latestMessage;

  if (!resolvedLatestMessage) {
    const { data: messageData } = await supabase
      .from("messages")
      .select("id, company_id, conversation_id, sender_type, body, sent_at")
      .eq("company_id", companyId)
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedLatestMessage = (messageData as RealtimeMessageRow | null) ?? null;
  }

  return mapRealtimeConversation(
    data as ClientConversationRow,
    resolvedLatestMessage,
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

function mapRealtimeConversation(
  conversation: ClientConversationRow,
  latestMessage: RealtimeMessageRow | null,
): InboxConversation {
  const customer = Array.isArray(conversation.customers)
    ? conversation.customers[0]
    : conversation.customers;
  const channel = Array.isArray(conversation.channels)
    ? conversation.channels[0]
    : conversation.channels;
  const platform = platformLabel(
    customer?.platform ?? channel?.name ?? channel?.type,
  );
  const name = customer?.name ?? "Unknown customer";

  return {
    aiEnabled: customer?.ai_enabled ?? true,
    avatar: initials(name),
    avatarUrl: customer?.avatar_url ?? null,
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
    lastReadAt: conversation.last_read_at,
    leadStage: formatLeadStage(customer?.lead_stage ?? "new"),
    platform,
    time: relativeTime(latestMessage?.sent_at ?? conversation.last_message_at),
    unread: conversation.unread_count,
  };
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

  return "Unknown";
}

function formatLeadStage(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const isLive = status === "live";
  const Icon = isLive ? Wifi : WifiOff;

  return (
    <Badge
      className={cn(
        "gap-1.5",
        isLive && "bg-[#ecfdf5] text-[#047857]",
        status === "connecting" && "bg-[#fffbeb] text-[#b45309]",
      )}
      variant="secondary"
    >
      <Icon className="size-3.5" />
      {isLive ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
    </Badge>
  );
}
