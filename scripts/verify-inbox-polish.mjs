import { existsSync, readFileSync } from "node:fs";

const migration =
  "supabase/migrations/20260618123349_add_conversation_read_tracking.sql";
const checks = [
  {
    file: migration,
    patterns: [
      "unread_count integer not null default 0",
      "last_read_at timestamptz",
      "increment_conversation_unread_count",
      "new.sender_type = 'customer'",
      "unread_count = unread_count + 1",
    ],
  },
  {
    file: "src/lib/inbox/data.ts",
    patterns: [
      'status?: "sending" | "sent" | "failed"',
      "lastReadAt: string | null",
      "conversation.unread_count",
    ],
  },
  {
    file: "src/components/inbox/inbox-module.tsx",
    patterns: [
      'event: "INSERT"',
      'table: "messages"',
      'event: "UPDATE"',
      'table: "conversations"',
      "refreshInboxSnapshot",
      "setSnapshot(refreshed)",
      "[TechSpd Realtime] SUBSCRIBED",
      "[TechSpd Realtime] messages INSERT",
      "[TechSpd Realtime] conversations UPDATE",
      "[TechSpd Realtime] snapshot refreshed",
      "[TechSpd Realtime] ${status}",
      ".subscribe((status, error) =>",
      "supabase.auth.getSession()",
      "supabase.auth.getUser()",
      "supabase.realtime.setAuth(session.access_token)",
      "realtimeAuthSessionExists",
      "messages INSERT payload",
      "conversations UPDATE payload",
      "applyRealtimeMessageRef.current",
      "applyRealtimeConversationRef.current",
      "[TechSpd Latency] realtime payload received",
      "[TechSpd Latency] UI updated",
      "realtimeToUiMs",
      'refreshInboxSnapshot("recovery:',
      "selectedConversationIdRef",
      "snapshotAppliedRef",
      "isNearBottomRef",
      "Latest message",
      "Realtime: ",
      'status: "sending"',
      'status: "failed"',
    ],
    absent: [
      '.on("broadcast"',
      "Notification.requestPermission()",
      "markConversationRead",
      "filter: `company_id=eq.${companyId}`",
      "setInterval(",
      "setTimeout(",
      'refreshInboxSnapshot("messages INSERT")',
      'refreshInboxSnapshot("conversations UPDATE")',
    ],
  },
];

const failures = [];

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures.push(`Missing file: ${check.file}`);
    continue;
  }

  const source = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      failures.push(`${check.file} is missing: ${pattern}`);
    }
  }

  for (const pattern of check.absent ?? []) {
    if (source.includes(pattern)) {
      failures.push(`${check.file} should not contain: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Inbox polish verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Inbox polish verification passed.");
