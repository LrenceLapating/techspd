import { existsSync, readFileSync } from "node:fs";

const checks = [
  {
    file: "src/lib/meta/integration.ts",
    patterns: [
      "subscribeConnectedFacebookWebhook",
      "subscribeFacebookPageWebhook",
      "https://graph.facebook.com/${subscribedAppsGraphVersion}/${pageId}/subscribed_apps",
      'method: "POST"',
      "webhook_subscribed: true",
      "webhook_subscribed_at: subscribedAt",
      "[meta-webhook] Facebook subscribed_apps response.",
      "page_id: pageId",
      "channel_id: channelId",
      "subscribed_apps_response: response",
      "meta_error_response: metaError",
      '.from("channels")',
      '.eq("platform", "facebook")',
      '.eq("is_connected", true)',
    ],
  },
  {
    file: "src/app/api/meta/webhook/subscribe/route.ts",
    patterns: [
      "getAuthenticatedMetaCompany",
      "subscribeConnectedFacebookWebhook",
      "webhook_subscribed: true",
      "webhook_subscribed_at",
      "meta_error",
    ],
  },
  {
    file: "src/components/settings/webhook-subscribe-button.tsx",
    patterns: [
      '"use client"',
      "Subscribe Webhook",
      'fetch("/api/meta/webhook/subscribe"',
      'method: "POST"',
    ],
  },
  {
    file: "src/lib/settings/channels.ts",
    patterns: [
      "settings",
      "webhookSubscribed",
      "webhookSubscribedAt",
      "webhook_subscribed",
      "webhook_subscribed_at",
    ],
  },
  {
    file: "src/components/settings/settings-module.tsx",
    patterns: [
      "WebhookSubscribeButton",
      "platformName === \"Facebook\"",
      "Webhook",
      "webhookSubscribed",
      "webhookSubscribedAt",
    ],
  },
  {
    file: "package.json",
    patterns: [
      "verify:meta-webhook-subscription",
      "scripts/verify-meta-webhook-subscription.mjs",
    ],
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
}

if (failures.length > 0) {
  console.error("Meta webhook subscription verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Meta webhook subscription verification passed.");
