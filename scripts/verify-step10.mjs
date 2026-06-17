import { existsSync, readFileSync } from "node:fs";

const checks = [
  {
    file: "src/app/api/meta/connect/facebook/route.ts",
    patterns: [
      "buildMetaAuthorizationUrl",
      "createMetaState",
      'provider: "facebook"',
      "META_APP_ID",
      "META_APP_SECRET",
    ],
    absent: ["placeholder=true", "META_FACEBOOK_PAGE_ACCESS_TOKEN"],
  },
  {
    file: "src/app/api/meta/connect/instagram/route.ts",
    patterns: [
      "buildMetaAuthorizationUrl",
      "createMetaState",
      'provider: "instagram"',
      "META_APP_ID",
      "META_APP_SECRET",
    ],
    absent: ["placeholder=true", "META_INSTAGRAM_PAGE_ACCESS_TOKEN"],
  },
  {
    file: "src/app/api/meta/callback/route.ts",
    patterns: [
      "parseMetaState",
      "providerFromValue",
      "exchangeMetaCodeForUserToken",
      "fetchMetaPages",
    ],
    absent: [
      "getMetaPlaceholderPayload",
      "placeholder",
      "META_FACEBOOK_PAGE_ID",
      "META_INSTAGRAM_USERNAME",
    ],
  },
  {
    file: "src/lib/meta/integration.ts",
    patterns: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_REDIRECT_URI",
      '.from("channels")',
      "page_access_token",
      "instagram_username",
      "access_token",
    ],
    absent: [
      "META_FACEBOOK_PAGE_ACCESS_TOKEN",
      "META_INSTAGRAM_ACCESS_TOKEN",
      "EAAB",
      "EAAI",
      "facebook-token",
      "instagram-token",
      "page_access_token: \"",
      "access_token: \"",
    ],
  },
  {
    file: "src/components/settings/settings-module.tsx",
    patterns: [
      "/api/meta/connect/facebook",
      "/api/meta/connect/instagram",
      "Connect Facebook",
      "Connect Instagram",
    ],
  },
  {
    file: ".env.example",
    patterns: [
      "META_APP_ID=",
      "META_APP_SECRET=",
      "META_REDIRECT_URI=",
      "META_FACEBOOK_SCOPES=",
      "META_INSTAGRAM_SCOPES=",
    ],
    absent: [
      "META_FACEBOOK_PAGE_ID=",
      "META_FACEBOOK_PAGE_NAME=",
      "META_FACEBOOK_PAGE_ACCESS_TOKEN=",
      "META_FACEBOOK_ACCESS_TOKEN=",
      "META_INSTAGRAM_PAGE_ID=",
      "META_INSTAGRAM_PAGE_NAME=",
      "META_INSTAGRAM_PAGE_ACCESS_TOKEN=",
      "META_INSTAGRAM_ID=",
      "META_INSTAGRAM_USERNAME=",
      "META_INSTAGRAM_ACCESS_TOKEN=",
    ],
  },
  {
    file: "package.json",
    patterns: ["verify:step10", "scripts/verify-step10.mjs"],
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
  console.error("Step 10 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 10 verification passed.");
