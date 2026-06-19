import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const webhookRoute = await readFile(
  new URL("../src/app/api/webhooks/meta/route.ts", import.meta.url),
  "utf8",
);
const webhookLibrary = await readFile(
  new URL("../src/lib/meta/webhook.ts", import.meta.url),
  "utf8",
);
const debugRoute = await readFile(
  new URL("../src/app/api/debug/instagram-channels/route.ts", import.meta.url),
  "utf8",
);

for (const marker of [
  "Instagram full incoming payload",
  "JSON.stringify(body)",
  "message_is_echo",
  "message_text",
  "trace_id",
  "execution_exit",
  "stop_reason",
]) {
  assert.ok(webhookRoute.includes(marker), `Missing webhook trace marker: ${marker}`);
}

for (const stage of [
  "channel_lookup",
  "customer_lookup",
  "conversation_lookup",
  "message_insert",
  "post_insert_updates",
]) {
  assert.ok(webhookLibrary.includes(stage), `Missing ingestion stage: ${stage}`);
}

for (const marker of [
  "META_DEBUG_TOKEN",
  'eq("platform", "instagram")',
  "channel_id",
  "company_id",
  "webhook_subscribed",
  "channel_name",
  "incoming_entry_id",
  "matches_incoming_entry_id",
  '"cache-control": "no-store"',
]) {
  assert.ok(debugRoute.includes(marker), `Missing debug endpoint marker: ${marker}`);
}

console.log("Instagram webhook trace verification passed.");
