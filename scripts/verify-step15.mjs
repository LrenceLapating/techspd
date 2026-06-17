import { existsSync, readFileSync } from "node:fs";

const files = {
  envExample: ".env.example",
  helper: "src/lib/n8n/ai-integration.ts",
  inboxData: "src/lib/inbox/data.ts",
  migration: "supabase/migrations/20260617110107_add_ai_message_sender_type.sql",
  package: "package.json",
  processRoute: "src/app/api/n8n/process-message/route.ts",
  saveRoute: "src/app/api/n8n/save-ai-reply/route.ts",
  readme: "README.md",
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
const helper = read(files.helper);
const inboxData = read(files.inboxData);
const migration = read(files.migration);
const pkg = read(files.package);
const processRoute = read(files.processRoute);
const saveRoute = read(files.saveRoute);
const readme = read(files.readme);

for (const pattern of [
  "export async function POST",
  "isAuthorizedN8nRequest",
  "parseProcessMessageBody",
  "processMessageForN8n",
  "Unauthorized",
]) {
  assert(processRoute.includes(pattern), `Process route missing: ${pattern}`);
}

for (const pattern of [
  "export async function POST",
  "isAuthorizedN8nRequest",
  "parseSaveAiReplyBody",
  "saveAiReply",
  "Unauthorized",
]) {
  assert(saveRoute.includes(pattern), `Save route missing: ${pattern}`);
}

for (const pattern of [
  "TECHSPD_N8N_API_KEY",
  "x-techspd-api-key",
  "timingSafeEqual",
  "message_id",
  "conversation_id",
  "customer_id",
  ".from(\"messages\")",
  ".from(\"conversations\")",
  ".from(\"customers\")",
  ".from(\"companies\")",
  ".from(\"channels\")",
  "customer.ai_enabled",
  "reason: \"AI disabled for this customer\"",
  "should_reply: false",
  "should_reply: true",
  "company_id: company.id",
  "platform: channel.platform ?? customer.platform ?? \"unknown\"",
  "latest_message: message.body",
  "recent_conversation_history: history",
  "channel_access_token: channel.access_token",
  "sender_type: \"ai\"",
  "last_message: payload.ai_message",
  "last_message_at: sentAt",
  "meta_message_id: payload.meta_message_id",
]) {
  assert(helper.includes(pattern), `n8n AI helper missing: ${pattern}`);
}

assert(
  envExample.includes("TECHSPD_N8N_API_KEY="),
  "Missing TECHSPD_N8N_API_KEY in .env.example.",
);
assert(
  migration.includes("alter type public.message_sender_type") &&
    migration.includes("add value if not exists 'ai'"),
  "Missing ai sender type migration.",
);
assert(
  inboxData.includes('"customer" | "agent" | "owner" | "ai" | "system"'),
  "Inbox data must understand ai sender_type.",
);
assert(pkg.includes("\"verify:step15\""), "Missing verify:step15 package script.");
assert(pkg.includes("verify:step15 && npm run lint"), "verify:all must include Step 15.");
assert(
  readme.includes("/api/n8n/process-message") &&
    readme.includes("/api/n8n/save-ai-reply") &&
    readme.includes("TECHSPD_N8N_API_KEY"),
  "README must document Step 15 n8n AI routes.",
);

if (failures.length > 0) {
  console.error("Step 15 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 15 verification passed.");
