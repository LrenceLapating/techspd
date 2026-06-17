import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "src/app/api/meta/callback/route.ts",
  "src/app/api/meta/pages/select/route.ts",
  "src/app/settings/meta/select/page.tsx",
  "src/lib/meta/integration.ts",
  "supabase/migrations/20260617006000_create_meta_oauth_sessions.sql",
];

const checks = [
  {
    file: "src/lib/meta/integration.ts",
    patterns: [
      "exchangeMetaCodeForUserToken",
      "exchangeForLongLivedMetaToken",
      "fetchMetaPages",
      "/me/accounts",
      "id,name,access_token,instagram_business_account{id,username}",
      "createMetaOAuthSession",
      "getMetaOAuthSession",
      "saveSelectedMetaPage",
      "userAccessToken",
      "pageAccessToken: page.accessToken",
      "accessToken: session.userAccessToken",
      '.schema("private")',
      '.from("meta_oauth_sessions")',
      '.from("meta_integrations")',
    ],
    absent: ["EAAB", "EAAI", "hardcoded_access_token"],
  },
  {
    file: "src/app/api/meta/callback/route.ts",
    patterns: [
      "exchangeMetaCodeForUserToken",
      "fetchMetaAccountsRaw",
      "createMetaOAuthSession",
      "NextResponse.redirect(selectUrl)",
      "instagramBusinessAccount",
      "Missing Meta OAuth code",
    ],
  },
  {
    file: "src/app/settings/meta/select/page.tsx",
    patterns: [
      "getMetaOAuthSession",
      "Connect this page",
      'action="/api/meta/pages/select"',
      'name="session_id"',
      'name="page_id"',
      "Instagram Professional Account",
    ],
    absent: ["accessToken", "pageAccessToken", "userAccessToken"],
  },
  {
    file: "src/app/api/meta/pages/select/route.ts",
    patterns: [
      "getAuthenticatedMetaCompany",
      "getMetaOAuthSession",
      "saveSelectedMetaPage",
      "session_id",
      "page_id",
      "NextResponse.redirect",
    ],
  },
  {
    file: "supabase/migrations/20260617006000_create_meta_oauth_sessions.sql",
    patterns: [
      "create table if not exists private.meta_oauth_sessions",
      "user_access_token text not null",
      "pages jsonb not null",
      "expires_at timestamptz not null",
      "revoke all on private.meta_oauth_sessions from anon, authenticated",
    ],
  },
  {
    file: "package.json",
    patterns: ["verify:step11", "scripts/verify-step11.mjs"],
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
  console.error("Step 11 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 11 verification passed.");
