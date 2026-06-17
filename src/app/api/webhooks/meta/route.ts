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
  let body: unknown;

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

  const { events, ignored } = parseMetaWebhookEvents(body);
  let processed = 0;
  let failed = 0;

  console.info("[meta-webhook] Received payload.", {
    events: events.length,
    ignored,
  });

  for (const event of events) {
    try {
      const result = await ingestMetaWebhookMessage(event);
      processed += 1;

      console.info("[meta-webhook] Message saved.", {
        channel_id: result.channel_id,
        company_id: result.company_id,
        conversation_id: result.conversation_id,
        customer_id: result.customer_id,
        message_id: result.message_id,
        platform: event.platform,
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
