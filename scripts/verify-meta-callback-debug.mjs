import { existsSync, readFileSync } from "node:fs";

const files = {
  callback: "src/app/api/meta/callback/route.ts",
  integration: "src/lib/meta/integration.ts",
  migration: "supabase/migrations/20260617164340_move_meta_oauth_storage_to_public_api_schema.sql",
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
const migration = read(files.migration);

for (const pattern of [
  "fetchMetaAccountsRaw",
  "debugMetaToken",
  "getRequestedMetaScopes",
  "debugMode",
  "debug: true",
  "https://graph.facebook.com/v19.0/me/accounts",
  "accountsResponse: accountsResult.payload",
  "granularTargetIds",
  "directPageFetchResults",
  "raw_accounts_response: accountsResult.payload",
  "requested_scopes: requestedScopes",
  "storageDiagnostics",
  "storageDiagnostic",
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
  "export function extractGranularPageTargetIds",
  "export async function fetchMetaPagesByTargetIds",
  "pageRelatedScopes",
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_engagement",
  "pages_read_user_content",
  "https://graph.facebook.com/v19.0/${pageId}",
  "https://graph.facebook.com/v19.0/debug_token",
  "input_token",
  "META_APP_ID",
  "META_APP_SECRET",
  "export function getRequestedMetaScopes",
  "META_FACEBOOK_SCOPES",
  "META_INSTAGRAM_SCOPES",
  "metaApiError",
  "metaStorageSchema = \"public\"",
  "metaOAuthSessionsTable = \"meta_oauth_sessions\"",
  "metaIntegrationsTable = \"meta_integrations\"",
  "getMetaStorageDebugDiagnostics",
  "[meta-storage] Supabase query failed.",
]) {
  assert(integration.includes(pattern), `Meta integration debug helper missing: ${pattern}`);
}

for (const pattern of [
  "create table if not exists public.meta_oauth_sessions",
  "create table if not exists public.meta_integrations",
  "from private.meta_oauth_sessions",
  "from private.meta_integrations",
  "alter table public.meta_oauth_sessions enable row level security",
  "alter table public.meta_integrations enable row level security",
  "revoke all on public.meta_oauth_sessions from anon, authenticated",
  "revoke all on public.meta_integrations from anon, authenticated",
]) {
  assert(
    migration.includes(pattern),
    `Meta storage compatibility migration missing: ${pattern}`,
  );
}

if (failures.length > 0) {
  console.error("Meta callback debug verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Meta callback debug verification passed.");
