import { existsSync, readFileSync } from "node:fs";

const files = {
  callback: "src/app/api/meta/callback/route.ts",
  integration: "src/lib/meta/integration.ts",
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

const callback = read(files.callback);
const integration = read(files.integration);

for (const pattern of [
  "fetchMetaAccountsRaw",
  "debugMetaToken",
  "getRequestedMetaScopes",
  "debugMode",
  "debug: true",
  "https://graph.facebook.com/v19.0/me/accounts",
  "raw_accounts_response: accountsResult.payload",
  "requested_scopes: requestedScopes",
  "token_debug: tokenDebugInfo",
  "meta_error:",
  "rawAccountsResponse: accountsResult.payload",
  "metaError: accountsResult.payload.error ?? null",
]) {
  assert(callback.includes(pattern), `Callback debug path missing: ${pattern}`);
}

for (const pattern of [
  "export async function fetchMetaAccountsRaw",
  "https://graph.facebook.com/v19.0/me/accounts",
  "id,name,access_token,instagram_business_account{id,username}",
  "export async function debugMetaToken",
  "https://graph.facebook.com/v19.0/debug_token",
  "input_token",
  "META_APP_ID",
  "META_APP_SECRET",
  "export function getRequestedMetaScopes",
  "META_FACEBOOK_SCOPES",
  "META_INSTAGRAM_SCOPES",
  "metaApiError",
]) {
  assert(integration.includes(pattern), `Meta integration debug helper missing: ${pattern}`);
}

if (failures.length > 0) {
  console.error("Meta callback debug verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Meta callback debug verification passed.");
