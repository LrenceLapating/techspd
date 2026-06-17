import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ingestIncomingMessage,
  parseIncomingMessageBody,
} from "@/lib/n8n/incoming-message";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;

  try {
    payload = parseIncomingMessageBody(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestIncomingMessage(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Incoming message ingestion failed.",
      },
      { status: 500 },
    );
  }
}

function isAuthorized(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const bearer =
    authorization?.startsWith("Bearer ") === true
      ? authorization.slice("Bearer ".length)
      : null;
  const headerSecret = request.headers.get("x-techspd-webhook-secret");
  const candidate = bearer ?? headerSecret;

  if (!candidate) {
    return false;
  }

  return safeCompare(candidate, secret);
}

function safeCompare(candidate: string, secret: string) {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}
