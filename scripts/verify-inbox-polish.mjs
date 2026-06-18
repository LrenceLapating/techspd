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
      "Notification.requestPermission()",
      "new Notification(",
      "playNotificationSound",
      "markConversationRead",
      "unread_count: 0",
      '.on("broadcast", { event: "typing" }',
      'event: "typing"',
      "Customer is typing",
      'status: "sending"',
      'status: "failed"',
      "isNearBottomRef",
      "distanceFromBottom < 120",
      "Jump to latest message",
      "refreshSnapshotAfterRealtimeEvent",
      "mergeMessages",
      "snapshotRefreshSequenceRef",
      "stale snapshot fallback ignored",
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
}

if (failures.length > 0) {
  console.error("Inbox polish verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Inbox polish verification passed.");
