import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "src/app/api/inbox/snapshot/route.ts",
  "src/app/page.tsx",
  "src/components/inbox/inbox-module.tsx",
  "src/lib/inbox/data.ts",
  "supabase/migrations/20260617004000_enable_realtime_messages.sql",
  "supabase/migrations/20260617181441_enable_realtime_conversations.sql",
];

const checks = [
  {
    file: "src/components/inbox/inbox-module.tsx",
    patterns: [
      '"use client"',
      "createClient",
      ".channel(",
      "postgres_changes",
      'event: "INSERT"',
      'table: "messages"',
      'event: "*"',
      'table: "conversations"',
      "filter: `company_id=eq.${companyId}`",
      "applyRealtimeMessage",
      "fetchConversationPreview",
      "fetchConversationMessages",
      "isNearBottomRef",
      "setSelectedConversationId",
    ],
    absent: [
      "/api/inbox/snapshot",
      "refreshSnapshot",
      "setSnapshot(nextSnapshot)",
    ],
  },
  {
    file: "src/app/api/inbox/snapshot/route.ts",
    patterns: [
      "supabase.auth.getUser",
      '.from("users")',
      '.select("company_id")',
      "getInboxSnapshot",
      "selectedConversationId",
    ],
    absent: ['searchParams.get("company_id")', "companyId = url.searchParams"],
  },
  {
    file: "src/lib/inbox/data.ts",
    patterns: [
      'from("conversations")',
      'from("messages")',
      '.eq("company_id", companyId)',
      "selectedConversationId: requestedSelectedConversationId",
      "conversationIds.includes(requestedSelectedConversationId)",
    ],
  },
  {
    file: "src/app/page.tsx",
    patterns: ["getInboxSnapshot", "companyId=", "initialSnapshot="],
  },
  {
    file: "supabase/migrations/20260617004000_enable_realtime_messages.sql",
    patterns: [
      "alter publication supabase_realtime add table public.messages",
    ],
  },
  {
    file: "supabase/migrations/20260617181441_enable_realtime_conversations.sql",
    patterns: [
      "alter publication supabase_realtime add table public.conversations",
    ],
  },
  {
    file: "package.json",
    patterns: ["verify:step9", "scripts/verify-step9.mjs"],
  },
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures.push(`Cannot inspect missing file: ${check.file}`);
    continue;
  }

  const text = readFileSync(check.file, "utf8");

  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${check.file} is missing pattern: ${pattern}`);
    }
  }

  for (const pattern of check.absent ?? []) {
    if (text.includes(pattern)) {
      failures.push(`${check.file} should not contain pattern: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Step 9 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 9 verification passed.");
