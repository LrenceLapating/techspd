import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const debugToken = process.env.META_DEBUG_TOKEN;

  if (!debugToken) {
    return noStoreJson(
      { error: "META_DEBUG_TOKEN is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const candidate = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!candidate || !safeCompare(candidate, debugToken)) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingEntryId = new URL(request.url).searchParams
    .get("entry_id")
    ?.trim() || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("channels")
    .select("channel_id, company_id, channel_name, settings")
    .eq("platform", "instagram")
    .order("channel_name", { ascending: true });

  if (error) {
    console.error("[instagram-channel-debug] Channel lookup failed.", {
      error: error.message,
      incoming_entry_id: incomingEntryId,
    });

    return noStoreJson(
      { error: "Instagram channel lookup failed." },
      { status: 500 },
    );
  }

  const instagramChannels = (data ?? []).map((channel) => {
    const settings = isRecord(channel.settings) ? channel.settings : {};

    return {
      channel_id: channel.channel_id,
      channel_name: channel.channel_name,
      company_id: channel.company_id,
      matches_incoming_entry_id:
        incomingEntryId === null ? null : channel.channel_id === incomingEntryId,
      webhook_subscribed: settings.webhook_subscribed === true,
    };
  });
  const matchingChannels = instagramChannels.filter(
    (channel) => channel.matches_incoming_entry_id === true,
  );

  return noStoreJson({
    any_channel_matches: matchingChannels.length > 0,
    incoming_entry_id: incomingEntryId,
    instagram_channels: instagramChannels,
    matching_channels: matchingChannels,
  });
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "cache-control": "no-store",
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
