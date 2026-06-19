import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ingestMetaWebhookMessage,
  parseMetaWebhookEvents,
} from "@/lib/meta/webhook";
import type { MetaWebhookMessageEvent } from "@/lib/meta/webhook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!expectedVerifyToken) {
    console.error("[meta-webhook] Missing META_WEBHOOK_VERIFY_TOKEN.");

    return NextResponse.json(
      { error: "Meta webhook verify token is not configured." },
      { status: 500 },
    );
  }

  if (
    mode === "subscribe" &&
    challenge &&
    verifyToken &&
    safeCompare(verifyToken, expectedVerifyToken)
  ) {
    console.info("[meta-webhook] Verification succeeded.");

    return new Response(challenge, {
      headers: {
        "content-type": "text/plain",
      },
      status: 200,
    });
  }

  console.warn("[meta-webhook] Verification failed.", { mode });

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const traceId = randomUUID();
  const webhookReceivedAt = new Date().toISOString();
  let body: unknown;

  console.info("[meta-webhook] Webhook received.", {
    trace_id: traceId,
    webhookReceivedAt,
  });
  console.info("[TechSpd Latency] webhook received", {
    trace_id: traceId,
    webhookReceivedAt,
  });

  try {
    body = await request.json();
  } catch (error) {
    console.error("[meta-webhook] STOP.", {
      error,
      execution_exit: "request_json",
      stop_reason: "invalid_json_body",
      trace_id: traceId,
    });

    return NextResponse.json({
      failed: 1,
      ignored: 0,
      processed: 0,
      received: true,
      trace_id: traceId,
    });
  }

  const bodyObject =
    body && typeof body === "object" && "object" in body
      ? body.object
      : null;

  if (bodyObject === "instagram") {
    console.info(
      "[meta-webhook] Instagram full incoming payload.",
      JSON.stringify(body),
    );
  }

  const { events, ignored, ignoredEvents } = parseMetaWebhookEvents(body);
  let processed = 0;
  let failed = 0;

  console.info("[meta-webhook] Received payload.", {
    body_object: bodyObject,
    events: events.length,
    ignored,
    trace_id: traceId,
  });

  for (const ignoredEvent of ignoredEvents) {
    console.warn("[meta-webhook] Ignored event.", {
      body_object: ignoredEvent.bodyObject,
      changes_keys: ignoredEvent.changesKeys,
      entry_id: ignoredEvent.entryId,
      entry_keys: ignoredEvent.entryKeys,
      final_decision: "ignored",
      execution_exit: "event_parser",
      message_is_echo: ignoredEvent.messageIsEcho,
      message_id: ignoredEvent.messageId,
      message_text: ignoredEvent.messageText,
      messaging_keys: ignoredEvent.messagingKeys,
      platform_resolved:
        ignoredEvent.bodyObject === "instagram" ? "instagram" : null,
      recipient_id: ignoredEvent.recipientId,
      reason_ignored: ignoredEvent.reason,
      sender_id: ignoredEvent.senderId,
      stop_reason: ignoredEvent.reason,
      trace_id: traceId,
      channel_id_matched: null,
    });
  }

  for (const event of events) {
    console.info("[meta-webhook] Flow trace.", {
      body_object: event.platform === "instagram" ? "instagram" : "page",
      channel_lookup_result: "pending",
      entry_id: event.entryId,
      platform_resolved: event.platform,
      recipient_id: event.recipientId,
      sender_id: event.platformUserId,
      stage: "webhook_event",
      message_id: event.messageId,
      message_is_echo: event.messageIsEcho,
      message_text: event.text,
      trace_id: traceId,
    });

    try {
      const result = await ingestMetaWebhookMessage(event, {
        traceId,
        webhookReceivedAt,
      });
      processed += 1;

      console.info("[meta-webhook] Message saved.", {
        channel_id: result.channel_id,
        company_id: result.company_id,
        conversation_id: result.conversation_id,
        customer_id: result.customer_id,
        message_id: result.message_id,
        platform: event.platform,
        database_inserted_at: result.database_inserted_at,
        webhook_received_at: result.webhook_received_at,
        webhook_to_database_ms: result.webhook_to_database_ms,
        execution_exit: "completed",
        trace_id: traceId,
      });

      if (event.platform === "instagram") {
        logInstagramMessageDecision({
          channelIdMatched: result.matched_channel_id,
          decision: "saved",
          event,
          traceId,
        });
      }
    } catch (error) {
      failed += 1;

      console.error("[meta-webhook] Message persistence failed.", {
        channel_id: event.channelId,
        error,
        message_id: event.messageId,
        platform: event.platform,
        trace_id: traceId,
      });

      if (event.platform === "instagram") {
        logInstagramMessageDecision({
          channelIdMatched: null,
          decision: "failed",
          event,
          traceId,
        });
      }
    }
  }

  return NextResponse.json({
    failed,
    ignored,
    processed,
    received: true,
    trace_id: traceId,
  });
}

function logInstagramMessageDecision({
  channelIdMatched,
  decision,
  event,
  traceId,
}: {
  channelIdMatched: string | null;
  decision: "failed" | "saved";
  event: MetaWebhookMessageEvent;
  traceId: string;
}) {
  console.info("[meta-webhook] Instagram message decision.", {
    body_object: "instagram",
    channel_id_matched: channelIdMatched,
    entry_id: event.entryId,
    final_decision: decision,
    message_is_echo: event.messageIsEcho,
    message_id: event.messageId,
    message_text: event.text,
    platform_resolved: event.platform,
    recipient_id: event.recipientId,
    sender_id: event.platformUserId,
    trace_id: traceId,
  });
}

function safeCompare(candidate: string, secret: string) {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}
