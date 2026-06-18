import { existsSync, readFileSync } from "node:fs";

const files = {
  inbox: "src/components/inbox/inbox-module.tsx",
  inboxData: "src/lib/inbox/data.ts",
  manualReply: "src/lib/messages/manual-reply.ts",
  migration: "supabase/migrations/20260617105010_add_owner_message_sender_type.sql",
  package: "package.json",
  route: "src/app/api/messages/send/route.ts",
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

const inbox = read(files.inbox);
const inboxData = read(files.inboxData);
const manualReply = read(files.manualReply);
const migration = read(files.migration);
const pkg = read(files.package);
const route = read(files.route);

for (const pattern of [
  "export async function POST",
  "parseManualReplyBody",
  "sendManualReply",
  "createClient",
  "NextResponse.json(result)",
]) {
  assert(route.includes(pattern), `Send route missing: ${pattern}`);
}

for (const pattern of [
  "conversation_id",
  "customer_id",
  "message",
  "supabase.auth.getUser()",
  ".from(\"users\")",
  ".select(\"company_id\")",
  ".from(\"conversations\")",
  ".eq(\"company_id\", companyId)",
  ".eq(\"customer_id\", customerId)",
  ".from(\"customers\")",
  ".from(\"channels\")",
  "access_token",
  "graphSenderIdForChannel",
  "linked_facebook_page_id",
  "https://graph.facebook.com/${graphVersion}/${channelId}/messages",
  "Authorization: `Bearer ${accessToken}`",
  "recipient",
  "messaging_type: \"RESPONSE\"",
  "sender_type: \"owner\"",
  "sender_user_id: user.id",
  "last_message: payload.message",
  "last_message_at: sentAt",
  "Manual replies are only available for Facebook and Instagram.",
]) {
  assert(manualReply.includes(pattern), `Manual reply helper missing: ${pattern}`);
}

for (const forbidden of [
  "META_FACEBOOK_PAGE_ACCESS_TOKEN",
  "META_INSTAGRAM_ACCESS_TOKEN",
  "META_FACEBOOK_ACCESS_TOKEN",
  "META_INSTAGRAM_PAGE_ACCESS_TOKEN",
]) {
  assert(
    !manualReply.includes(forbidden),
    `Manual reply helper must not use page tokens from env: ${forbidden}`,
  );
}

for (const pattern of [
  "/api/messages/send",
  "conversation_id: conversation.id",
  "customer_id: conversation.customer.id",
  "message: messageBody",
  "addOptimisticMessage",
  "confirmOptimisticMessage",
  "removeOptimisticMessage",
  "onMessageSent",
  "sendError",
  "isSending",
  "type=\"submit\"",
]) {
  assert(inbox.includes(pattern), `Inbox composer missing: ${pattern}`);
}

assert(
  inboxData.includes('sender_type: "customer" | "agent" | "owner" | "ai" | "system"') &&
    inboxData.includes('message.sender_type === "agent" || message.sender_type === "owner"') &&
    inboxData.includes("id: conversation.customer_id"),
  "Inbox data must expose customer ID and render owner messages.",
);
assert(
  migration.includes("alter type public.message_sender_type") &&
    migration.includes("add value if not exists 'owner'"),
  "Missing owner sender type migration.",
);
assert(pkg.includes("\"verify:step14\""), "Missing verify:step14 package script.");
assert(pkg.includes("verify:step14"), "verify:all must include Step 14.");

if (failures.length > 0) {
  console.error("Step 14 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 14 verification passed.");
