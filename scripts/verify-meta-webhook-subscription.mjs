import { existsSync, readFileSync } from "node:fs";

const checks = [
  {
    file: "src/lib/meta/integration.ts",
    patterns: [
      "subscribeConnectedFacebookWebhook",
      "subscribeFacebookPageWebhook",
      "subscribeConnectedInstagramWebhook",
      "instagramSubscribedFields",
      '"messages,message_echoes,message_reads"',
      '"linked_facebook_page_id"',
      '.eq("channel_id", linkedPageId)',
      'platform: "instagram"',
      "https://graph.facebook.com/${subscribedAppsGraphVersion}/${pageId}/subscribed_apps",
      "facebookMessengerSubscribedFields",
      "messages,messaging_postbacks,message_echoes",
      "new URLSearchParams({",
      "subscribedFields: facebookMessengerSubscribedFields",
      "access_token: pageAccessToken",
      'method: "POST"',
      "body,",
      "webhook_subscribed: true",
      "webhook_subscribed_at: subscribedAt",
      "[meta-webhook] Facebook subscribed_apps response.",
      "[meta-webhook] Instagram subscribed_apps response.",
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
      "subscribeConnectedInstagramWebhook",
      'body?.platform === "instagram"',
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
      "JSON.stringify({ platform })",
      'platform: "facebook" | "instagram"',
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
      'platformName === "Facebook" || platformName === "Instagram"',
      'platform={platformName === "Instagram" ? "instagram" : "facebook"}',
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

const forbiddenPatterns = [
  {
    file: "src/lib/meta/integration.ts",
    patterns: ['const instagramSubscribedFields = "messages,comments,mentions"'],
  },
];

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

for (const check of forbiddenPatterns) {
  const text = readFileSync(check.file, "utf8");

  for (const pattern of check.patterns) {
    if (text.includes(pattern)) {
      failures.push(`${check.file} still contains forbidden pattern: ${pattern}`);
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
