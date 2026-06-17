import { existsSync, readFileSync } from "node:fs";

const files = {
  adminClient: "src/lib/supabase/admin.ts",
  env: "src/lib/supabase/env.ts",
  envExample: ".env.example",
  incomingMessage: "src/lib/n8n/incoming-message.ts",
  migration: "supabase/migrations/20260617003000_add_channel_external_id.sql",
  package: "package.json",
  route: "src/app/api/webhooks/incoming-message/route.ts",
};

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const [name, path] of Object.entries(files)) {
  assert(existsSync(path), `Missing ${name}: ${path}`);
}

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const adminClient = read(files.adminClient);
const env = read(files.env);
const envExample = read(files.envExample);
const incoming = read(files.incomingMessage);
const migration = read(files.migration);
const pkg = read(files.package);
const route = read(files.route);

assert(route.includes("export async function POST"), "Missing POST route handler.");
assert(
  route.includes("src/app/api/webhooks/incoming-message") ||
    existsSync(files.route),
  "Missing POST /api/webhooks/incoming-message route.",
);
assert(
  route.includes("N8N_WEBHOOK_SECRET") &&
    route.includes("timingSafeEqual") &&
    route.includes("authorization") &&
    route.includes("x-techspd-webhook-secret"),
  "Webhook route must use secure shared-secret authorization.",
);
assert(
  route.includes("parseIncomingMessageBody") &&
    route.includes("ingestIncomingMessage") &&
    route.includes("NextResponse.json(result)"),
  "Webhook route must validate, ingest, and return the ingestion result.",
);

for (const field of [
  "company_id",
  "platform",
  "channel_id",
  "platform_user_id",
  "customer_name",
  "message",
  "attachment_url",
  "timestamp",
]) {
  assert(incoming.includes(field), `Missing expected body field: ${field}`);
}

for (const operation of [
  ".from(\"channels\")",
  ".from(\"customers\")",
  ".from(\"conversations\")",
  ".from(\"messages\")",
  "findOrCreateChannel",
  "findOrCreateCustomer",
  "findOrCreateConversation",
  "sender_type: \"customer\"",
  "ai_reply_allowed",
  "customer.ai_enabled",
]) {
  assert(incoming.includes(operation), `Missing n8n ingestion operation: ${operation}`);
}

assert(
  incoming.includes("ai_enabled") &&
    incoming.includes("customer_id") &&
    incoming.includes("conversation_id"),
  "Webhook response must include customer_id, conversation_id, and ai_enabled.",
);
assert(
  adminClient.includes("@supabase/supabase-js") &&
    adminClient.includes("persistSession: false") &&
    adminClient.includes("supabaseServiceRoleKey"),
  "Admin Supabase client must be server-side and sessionless.",
);
assert(
  env.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    envExample.includes("SUPABASE_SERVICE_ROLE_KEY=") &&
    envExample.includes("N8N_WEBHOOK_SECRET="),
  "Missing Step 8 server-only environment variables.",
);
assert(
  migration.includes("external_id") &&
    migration.includes("channels_company_id_external_id_idx"),
  "Missing channel external_id migration.",
);
assert(pkg.includes("\"verify:step8\""), "Missing verify:step8 package script.");

if (failures.length > 0) {
  console.error("Step 8 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 8 verification passed.");
