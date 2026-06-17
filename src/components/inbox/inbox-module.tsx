"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Bot,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Laugh,
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
  const [isPending, startTransition] = useTransition();

  const selectedConversation = useMemo(
    () =>
      snapshot.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ??
      snapshot.conversations[0] ??
      null,
    [selectedConversationId, snapshot.conversations],
  );

  const refreshSnapshot = (conversationId: string | null) => {
    startTransition(async () => {
      const params = new URLSearchParams();

      if (conversationId) {
        params.set("conversationId", conversationId);
      }

      const response = await fetch(`/api/inbox/snapshot?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextSnapshot = (await response.json()) as InboxSnapshot;
      setSnapshot(nextSnapshot);
      setSelectedConversationId(nextSnapshot.selectedConversationId);
    });
  };

  useEffect(() => {
    if (!companyId) {
      setRealtimeStatus("offline");
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel | null = supabase
      .channel(`company-${companyId}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `company_id=eq.${companyId}`,
          schema: "public",
          table: "messages",
        },
        () => {
          refreshSnapshot(selectedConversationId);
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(status === "SUBSCRIBED" ? "live" : "connecting");
      });

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [companyId, selectedConversationId]);

  return (
    <section className="grid min-h-[calc(100vh-172px)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <ConversationList
        conversations={snapshot.conversations}
        isPending={isPending}
        onSelect={(conversationId) => {
          setSelectedConversationId(conversationId);
          refreshSnapshot(conversationId);
        }}
        realtimeStatus={realtimeStatus}
        selectedConversationId={selectedConversation?.id ?? null}
      />
      <ChatPanel
        conversation={selectedConversation}
        isRefreshing={isPending}
        messages={snapshot.messages}
        onMessageSent={() => {
          setSendError(null);
          refreshSnapshot(selectedConversation?.id ?? null);
        }}
        onSendError={setSendError}
        sendError={sendError}
      />
      <CustomerPanel conversation={selectedConversation} />
    </section>
  );
}

function ConversationList({
  conversations,
  isPending,
  onSelect,
  realtimeStatus,
  selectedConversationId,
}: {
  conversations: InboxConversation[];
  isPending: boolean;
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
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <ConversationCard
                conversation={conversation}
                isActive={conversation.id === selectedConversationId}
                isPending={isPending}
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
  isPending,
  onSelect,
}: {
  conversation: InboxConversation;
  isActive: boolean;
  isPending: boolean;
  onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-xl border bg-background/80 p-3 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-card",
        isActive && "border-primary bg-card ring-2 ring-primary/10",
      )}
      disabled={isPending}
      onClick={() => onSelect(conversation.id)}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          {conversation.avatar || "?"}
        </div>
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
            <Badge variant={conversation.aiEnabled ? "success" : "warning"}>
              {conversation.aiEnabled ? "AI On" : "AI Off"}
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
  isRefreshing,
  messages,
  onMessageSent,
  onSendError,
  sendError,
}: {
  conversation: InboxConversation | null;
  isRefreshing: boolean;
  messages: InboxMessage[];
  onMessageSent: () => void;
  onSendError: (message: string | null) => void;
  sendError: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

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

    try {
      const response = await fetch("/api/messages/send", {
        body: JSON.stringify({
          conversation_id: conversation.id,
          customer_id: conversation.customer.id,
          message: trimmedDraft,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Manual reply failed.");
      }

      setDraft("");
      onMessageSent();
    } catch (error) {
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
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                {conversation.avatar || "?"}
              </div>
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

        <div className="flex-1 space-y-4 overflow-y-auto bg-secondary/30 p-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <ChatBubble message={message} key={message.id} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              No messages yet for this customer.
            </div>
          )}
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
              disabled={!trimmedDraft || isSending || isRefreshing}
              type="submit"
            >
              <Send className="size-4" />
              {isSending ? "Sending" : "Send"}
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
      </div>
    </div>
  );
}

function CustomerPanel({
  conversation,
}: {
  conversation: InboxConversation | null;
}) {
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
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
              {conversation.avatar || "?"}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">
                {conversation.customer.name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <PlatformBadge platform={conversation.platform} />
                <Badge variant={conversation.aiEnabled ? "success" : "warning"}>
                  {conversation.aiEnabled ? "AI enabled" : "AI disabled"}
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

        <div className="space-y-3 rounded-xl border bg-background/72 p-3">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span>AI Auto Reply</span>
            <input
              aria-label="AI Auto Reply toggle"
              className="size-5 accent-primary"
              defaultChecked={conversation.aiEnabled}
              name="ai_enabled"
              type="checkbox"
            />
          </label>
          {!conversation.aiEnabled ? (
            <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412]">
              Human Mode Active - AI will not reply
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
