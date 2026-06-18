import { existsSync, readFileSync } from "node:fs";

const inboxPath = "src/components/inbox/inbox-module.tsx";
const pagePath = "src/app/page.tsx";
const packagePath = "package.json";

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

assert(existsSync(inboxPath), "Missing inbox module component.");
assert(existsSync(pagePath), "Missing inbox page route.");

const inbox = existsSync(inboxPath) ? readFileSync(inboxPath, "utf8") : "";
const page = existsSync(pagePath) ? readFileSync(pagePath, "utf8") : "";
const pkg = readFileSync(packagePath, "utf8");

assert(page.includes("<InboxModule"), "Root inbox page must render InboxModule.");

for (const tab of ["All", "Facebook", "Instagram", "TikTok", "Unread", "AI Off"]) {
  assert(inbox.includes(`"${tab}"`), `Missing inbox tab: ${tab}`);
}

for (const required of [
  "Conversation list",
  "conversationSearch",
  "ConversationCard",
  "avatar",
  "PlatformBadge",
  "lastMessage",
  "unread",
  "aiEnabled",
]) {
  assert(inbox.includes(required), `Missing conversation list requirement: ${required}`);
}

for (const required of [
  "ChatPanel",
  "Customer",
  "AI reply",
  "Owner",
  "messageComposer",
  "Send",
  "Paperclip",
  "Laugh",
  "Mark Lead",
  "Mark Converted",
  "Add Note",
]) {
  assert(inbox.includes(required), `Missing chat panel requirement: ${required}`);
}

for (const required of [
  "Customer record",
  "Phone",
  "Email",
  "Location",
  "Platform",
  "Tags",
  "Notes",
  "Lead stage",
  "New",
  "Interested",
  "Follow Up",
  "Converted",
  "Lost",
  "AI Auto Reply",
  "AI Enabled",
  "Human Mode",
  "AI replies enabled",
  "Human mode active",
  "Conversion",
]) {
  assert(inbox.includes(required), `Missing customer panel requirement: ${required}`);
}

assert(
  inbox.includes("Human Mode Active - AI will not reply") ||
    inbox.includes("Human Mode Active — AI will not reply"),
  "Missing required human mode message for AI-off customers.",
);
assert(
  inbox.includes("Owner can always manually reply"),
  "Missing manual owner reply assurance.",
);
assert(
  inbox.includes("ai_enabled"),
  "Missing ai_enabled customer control.",
);
for (const requirement of [
  'role="switch"',
  "aria-checked={conversation.aiEnabled}",
  'bg-[#16a34a]',
  'bg-[#9ca3af]',
  ".update({ ai_enabled: aiEnabled })",
  '.eq("company_id", companyId)',
  '.eq("id", customerId)',
  "applyValue(previousAiEnabled)",
]) {
  assert(inbox.includes(requirement), `AI toggle requirement missing: ${requirement}`);
}
assert(
  inbox.includes("xl:grid-cols-[320px_minmax(0,1fr)_340px]"),
  "Inbox must use a responsive 3-panel desktop layout.",
);
assert(
  pkg.includes("\"verify:step4\""),
  "Missing verify:step4 package script.",
);

if (failures.length > 0) {
  console.error("Step 4 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 4 verification passed.");
