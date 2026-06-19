import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ingestMetaWebhookMessage,
  parseMetaWebhookEvents,
} from "@/lib/meta/webhook";

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
  const webhookReceivedAt = new Date().toISOString();
  let body: unknown;

  console.info("[TechSpd Latency] webhook received", {
    webhookReceivedAt,
  });

  try {
    body = await request.json();
  } catch (error) {
    console.error("[meta-webhook] Invalid JSON body.", { error });

    return NextResponse.json({
      failed: 1,
      ignored: 0,
      processed: 0,
      received: true,
    });
  }

  const { events, ignored, ignoredEvents } = parseMetaWebhookEvents(body);
  let processed = 0;
  let failed = 0;

  console.info("[meta-webhook] Received payload.", {
    object:
      body && typeof body === "object" && "object" in body
        ? body.object
        : null,
    events: events.length,
    ignored,
  });

  for (const ignoredEvent of ignoredEvents) {
    console.warn("[meta-webhook] Ignored event.", {
      body_object: ignoredEvent.bodyObject,
      changes_keys: ignoredEvent.changesKeys,
      entry_id: ignoredEvent.entryId,
      entry_keys: ignoredEvent.entryKeys,
      messaging_keys: ignoredEvent.messagingKeys,
      reason_ignored: ignoredEvent.reason,
    });
  }

  for (const event of events) {
    try {
      const result = await ingestMetaWebhookMessage(event, {
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
      });
    } catch (error) {
      failed += 1;

      console.error("[meta-webhook] Message persistence failed.", {
        channel_id: event.channelId,
        error,
        message_id: event.messageId,
        platform: event.platform,
      });
    }
  }

  return NextResponse.json({
    failed,
    ignored,
    processed,
    received: true,
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
