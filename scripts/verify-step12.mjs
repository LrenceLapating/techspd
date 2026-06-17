import { existsSync, readFileSync } from "node:fs";

const checks = [
  {
    file: "src/lib/meta/integration.ts",
    patterns: [
      "buildMetaAuthorizationUrl",
      "throw new Error(\"Missing META_APP_ID or META_APP_SECRET.\")",
      "exchangeMetaCodeForUserToken",
      "fetchMetaPages",
      "/me/accounts",
      "id,name,access_token,instagram_business_account{id,username}",
      "saveSelectedMetaPage",
      "access_token: input.pageAccessToken",
      "channel_id: input.pageId",
      "channel_name: input.pageName",
      "platform: \"facebook\"",
      "platform: \"instagram\"",
      "channel_id: input.instagramId",
      "channel_name: input.instagramUsername",
      "is_connected: true",
      "connected_at: connectedAt",
      "onConflict: \"company_id,platform,channel_id\"",
    ],
    absent: [
      "getMetaPlaceholderPayload",
      "META_FACEBOOK_PAGE_ACCESS_TOKEN",
      "META_INSTAGRAM_ACCESS_TOKEN",
      "META_FACEBOOK_PAGE_ID",
      "META_INSTAGRAM_USERNAME",
      "placeholder",
    ],
  },
  {
    file: "src/app/api/meta/connect/facebook/route.ts",
    patterns: ["NextResponse.redirect(authUrl)", "requiredEnv", "META_APP_ID"],
    absent: ["placeholder=true"],
  },
  {
    file: "src/app/api/meta/connect/instagram/route.ts",
    patterns: ["NextResponse.redirect(authUrl)", "requiredEnv", "META_APP_ID"],
    absent: ["placeholder=true"],
  },
  {
    file: "src/app/api/meta/callback/route.ts",
    patterns: [
      "Meta OAuth was cancelled or failed.",
      "Missing Meta OAuth code.",
      "No Facebook Pages were returned by Meta.",
      "No Facebook Pages with linked Instagram Professional Accounts",
      "createMetaOAuthSession",
      "NextResponse.redirect(selectUrl)",
    ],
    absent: ["placeholder", "getMetaPlaceholderPayload"],
  },
  {
    file: "src/app/api/meta/pages/select/route.ts",
    patterns: [
      "getAuthenticatedMetaCompany",
      "getMetaOAuthSession",
      "saveSelectedMetaPage",
      "Meta OAuth session expired or does not belong to this company.",
      "Unable to save selected Meta page.",
    ],
  },
  {
    file: "src/lib/settings/channels.ts",
    patterns: [
      "getConnectedChannels",
      '.from("channels")',
      '.eq("company_id", companyId)',
      "platform,channel_id,channel_name",
      "is_connected",
    ],
  },
  {
    file: "src/app/settings/page.tsx",
    patterns: ["getConnectedChannels", "companyId", "channels={channels}"],
  },
  {
    file: "src/components/settings/settings-module.tsx",
    patterns: [
      "ConnectedChannel",
      "renderedChannels",
      "status: connected?.isConnected ? \"Connected\" : \"Not Connected\"",
      "connected?.channelName",
    ],
  },
  {
    file: "supabase/migrations/20260617007000_add_saas_meta_channel_fields.sql",
    patterns: [
      "add column if not exists platform text",
      "add column if not exists channel_id text",
      "add column if not exists channel_name text",
      "add column if not exists access_token text",
      "add column if not exists connected_at timestamptz",
      "add column if not exists is_connected boolean",
      "channels_company_id_platform_channel_id_idx",
    ],
  },
  {
    file: ".env.example",
    patterns: [
      "META_APP_ID=",
      "META_APP_SECRET=",
      "META_REDIRECT_URI=",
      "META_GRAPH_VERSION=",
      "META_FACEBOOK_SCOPES=",
      "META_INSTAGRAM_SCOPES=",
    ],
    absent: [
      "META_FACEBOOK_PAGE_ACCESS_TOKEN=",
      "META_FACEBOOK_ACCESS_TOKEN=",
      "META_INSTAGRAM_PAGE_ACCESS_TOKEN=",
      "META_INSTAGRAM_ACCESS_TOKEN=",
      "META_FACEBOOK_PAGE_ID=",
      "META_INSTAGRAM_ID=",
    ],
  },
  {
    file: "package.json",
    patterns: ["verify:step12", "scripts/verify-step12.mjs"],
  },
];

const failures = [];

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
  console.error("Step 12 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 12 verification passed.");
