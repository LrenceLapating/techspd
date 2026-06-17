import { existsSync, readFileSync } from "node:fs";

const files = {
  envExample: ".env.example",
  migration: "supabase/migrations/20260617102853_add_conversation_last_message.sql",
  package: "package.json",
  route: "src/app/api/webhooks/meta/route.ts",
  webhook: "src/lib/meta/webhook.ts",
};

const failures = [];
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const [name, path] of Object.entries(files)) {
  assert(existsSync(path), `Missing ${name}: ${path}`);
}

const envExample = read(files.envExample);
const migration = read(files.migration);
const pkg = read(files.package);
const route = read(files.route);
const webhook = read(files.webhook);

for (const pattern of [
  "export async function GET",
  "export async function POST",
  "META_WEBHOOK_VERIFY_TOKEN",
  "hub.mode",
  "hub.verify_token",
  "hub.challenge",
  "timingSafeEqual",
  "status: 403",
  "parseMetaWebhookEvents",
  "ingestMetaWebhookMessage",
  "received: true",
]) {
  assert(route.includes(pattern), `Meta webhook route missing: ${pattern}`);
}

for (const pattern of [
  "platformFromObject",
  "object",
  "instagram",
  "page",
  "entry",
  "messaging",
  "sender",
  "recipient",
  "message",
  "is_echo",
  "attachments",
  "message.text",
  "message.mid",
  "pageId",
  "instagramId",
  "platformUserId === recipientId",
]) {
  assert(webhook.includes(pattern), `Meta parser missing: ${pattern}`);
}

for (const operation of [
  ".from(\"channels\")",
  ".eq(\"platform\", event.platform)",
  ".eq(\"channel_id\", event.channelId)",
  ".eq(\"external_id\", event.channelId)",
  ".eq(\"is_connected\", true)",
  ".from(\"customers\")",
  "`${event.platform}:${event.platformUserId}`",
  ".from(\"conversations\")",
  ".from(\"messages\")",
  "sender_type: \"customer\"",
  "last_message: body",
  "last_message_at: event.timestamp",
  "ai_reply_allowed",
  "page_id: event.pageId",
  "instagram_id: event.instagramId",
  "source: \"meta_webhook\"",
]) {
  assert(webhook.includes(operation), `Meta persistence missing: ${operation}`);
}

for (const forbidden of [
  "sendAi",
  "generateAi",
  "openai",
  "graph.facebook.com",
]) {
  assert(
    !webhook.toLowerCase().includes(forbidden.toLowerCase()),
    `Meta webhook helper should not trigger outbound or AI work: ${forbidden}`,
  );
}

assert(
  migration.includes("add column if not exists last_message text"),
  "Missing conversations.last_message migration.",
);
assert(
  envExample.includes("META_WEBHOOK_VERIFY_TOKEN="),
  "Missing META_WEBHOOK_VERIFY_TOKEN in .env.example.",
);
assert(pkg.includes("\"verify:step13\""), "Missing verify:step13 package script.");
assert(pkg.includes("verify:step13"), "verify:all must include Step 13.");

if (failures.length > 0) {
  console.error("Step 13 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 13 verification passed.");
