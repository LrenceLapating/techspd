"use client";

import { useState } from "react";
import { RadioTower } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type WebhookSubscribeButtonProps = {
  disabled?: boolean;
  isSubscribed?: boolean;
  platform: "facebook" | "instagram";
};

type SubscribeState = "idle" | "loading" | "success" | "error";

export function WebhookSubscribeButton({
  disabled,
  isSubscribed,
  platform,
}: WebhookSubscribeButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<SubscribeState>("idle");

  async function subscribeWebhook() {
    setMessage(null);
    setState("loading");

    const response = await fetch("/api/meta/webhook/subscribe", {
      body: JSON.stringify({ platform }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      webhook_subscribed_at?: string;
    };

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to subscribe webhook.");
      setState("error");
      return;
    }

    setMessage(
      payload.webhook_subscribed_at
        ? `Subscribed ${formatWebhookDate(payload.webhook_subscribed_at)}`
        : `${platform === "instagram" ? "Instagram" : "Facebook"} webhook subscribed.`,
    );
    setState("success");
    router.refresh();
  }

  return (
    <div className="mt-5 space-y-2">
      <Button
        className="w-full"
        disabled={disabled || state === "loading"}
        onClick={subscribeWebhook}
        type="button"
        variant={isSubscribed || state === "success" ? "secondary" : "outline"}
      >
        <RadioTower className="size-4" />
        {state === "loading" ? "Subscribing..." : "Subscribe Webhook"}
      </Button>
      {message ? (
        <p
          className={
            state === "error"
              ? "text-xs font-medium text-destructive"
              : "text-xs font-medium text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function formatWebhookDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
