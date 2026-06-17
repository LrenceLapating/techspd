# TechSpd

TechSpd is a premium SaaS dashboard foundation built with Next.js 15,
TypeScript, Tailwind CSS, shadcn-style UI primitives, React Query, Zustand, and
Supabase SSR utilities.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

- `src/app` - App Router layout, providers, and routes.
- `src/app/auth` - signup, login, forgot password, update password, and auth callback routes.
- `src/app/customers` - protected dashboard section route.
- `src/app/analytics` - protected dashboard section route.
- `src/app/conversions` - protected dashboard section route.
- `src/app/settings` - protected dashboard section route.
- `src/components/ui` - reusable shadcn-style UI primitives.
- `src/components/auth` - reusable authentication form shell components.
- `src/components/dashboard` - protected dashboard shell.
- `src/components/analytics` - company-scoped analytics cards and chart placeholders.
- `src/components/inbox` - unified inbox module and customer conversation UI.
- `src/components/sales` - customers and conversions management modules.
- `src/components/settings` - settings panels and tenant channel connections.
- `src/lib/dashboard` - authenticated dashboard context and tenant-scoped metrics.
- `src/lib/analytics` - company-scoped analytics queries and chart aggregation.
- `src/lib/inbox` - company-scoped inbox snapshots for conversations and chat messages.
- `src/lib/meta` - Meta OAuth, page selection, and channel persistence helpers.
- `src/lib/n8n` - n8n webhook ingestion helpers.
- `src/lib/sales` - customer filters, conversion reads, and sales formatting helpers.
- `src/lib/supabase` - browser, server, and middleware Supabase clients.
- `src/lib/stores` - Zustand stores.
- `src/lib/utils.ts` - shared utility helpers.
- `middleware.ts` - Supabase session refresh middleware.
- `supabase/migrations` - SQL migrations for the multi-tenant database.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
N8N_WEBHOOK_SECRET=
TECHSPD_N8N_API_KEY=
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=
META_GRAPH_VERSION=
META_FACEBOOK_SCOPES=
META_INSTAGRAM_SCOPES=
META_WEBHOOK_VERIFY_TOKEN=
```

Use a Supabase publishable key for browser-safe access. Keep secret and service
role keys server-only. Meta app secrets and access tokens are server-only and
must not use a `NEXT_PUBLIC_` prefix.

## Scripts

- `npm run dev` - start local development.
- `npm run build` - create a production build.
- `npm run start` - run the production server.
- `npm run lint` - run ESLint.
- `npm run verify:step2` - statically verify Step 2 auth routes and migration requirements.
- `npm run verify:step3` - statically verify Step 3 dashboard layout requirements.
- `npm run verify:step4` - statically verify Step 4 inbox module requirements.
- `npm run verify:step5` - statically verify Step 5 customers and conversions requirements.
- `npm run verify:step6` - statically verify Step 6 analytics requirements.
- `npm run verify:step7` - statically verify Step 7 settings and channel UI requirements.
- `npm run verify:step8` - statically verify Step 8 n8n webhook requirements.
- `npm run verify:step9` - statically verify Step 9 realtime inbox requirements.
- `npm run verify:step10` - statically verify Step 10 Meta integration route structure.
- `npm run verify:step11` - statically verify Step 11 real Meta OAuth and page connection requirements.
- `npm run verify:step12` - statically verify Step 12 SaaS Meta OAuth channel requirements.
- `npm run verify:step13` - statically verify Step 13 Meta webhook receiving requirements.
- `npm run verify:step14` - statically verify Step 14 manual owner reply requirements.
- `npm run verify:step15` - statically verify Step 15 n8n AI integration requirements.
- `npm run verify:all` - run Step 2 checks through Step 15 checks, lint, and production build.

## Deployment

The structure is ready for Vercel. Add the same Supabase environment variables
in the Vercel project settings before deploying.

## Supabase

Run the SQL in `supabase/migrations/20260616112605_create_multi_tenant_auth_schema.sql`
against your Supabase project, then add the public project URL and publishable
key to your local environment file. No local database is required for the app
foundation.

After Step 5, also run:

```bash
supabase/migrations/20260617002000_add_customer_workflow_fields.sql
```

This adds customer workflow fields for platform, AI status, lead stage,
converted state, converted date, last activity, and location. It also adds a
database trigger that automatically creates or updates a conversion record when
a customer is marked converted.

After Step 8, also run:

```bash
supabase/migrations/20260617003000_add_channel_external_id.sql
```

This adds `channels.external_id` so webhook payload channel IDs can be mapped to
the internal Supabase channel row.

After Step 9, also run:

```bash
supabase/migrations/20260617004000_enable_realtime_messages.sql
```

This publishes `public.messages` changes to Supabase Realtime so the unified
inbox can react immediately when new social messages are inserted.

After Step 10, also run:

```bash
supabase/migrations/20260617005000_create_meta_integration_placeholders.sql
```

This creates `private.meta_integrations` for future Facebook and Instagram OAuth
tokens. The app writes sensitive Meta values there with the server service role
and mirrors only non-sensitive channel status into `public.channels`.

After Step 11, also run:

```bash
supabase/migrations/20260617006000_create_meta_oauth_sessions.sql
```

This creates `private.meta_oauth_sessions` for short-lived, server-side OAuth
page selection sessions. The browser only receives page IDs and names; user and
page access tokens stay in private server-side storage.

After Step 12, also run:

```bash
supabase/migrations/20260617007000_add_saas_meta_channel_fields.sql
```

This adds SaaS channel connection fields to `public.channels`: `platform`,
`channel_id`, `channel_name`, `access_token`, `connected_at`, and
`is_connected`. Each row remains scoped by `company_id` and existing RLS policies
continue to restrict companies to their own channels.

After Step 13, also run:

```bash
supabase/migrations/20260617102853_add_conversation_last_message.sql
```

This adds `conversations.last_message` so webhook ingestion can keep the latest
message summary on each conversation while still storing the full transcript in
`public.messages`.

After Step 14, also run:

```bash
supabase/migrations/20260617105010_add_owner_message_sender_type.sql
```

This adds `owner` to `public.message_sender_type` so manual replies from the
inbox can be stored distinctly from customer, system, and older agent messages.

After Step 15, also run:

```bash
supabase/migrations/20260617110107_add_ai_message_sender_type.sql
```

This adds `ai` to `public.message_sender_type` so n8n-generated AI replies can
be stored separately from customer, owner, and system messages.

The first migration creates:

- `companies`
- `users`
- `channels`
- `customers`
- `conversations`
- `messages`
- `customer_notes`
- `customer_tags`
- `conversions`

Each data table is scoped by `company_id`, and Row Level Security policies
restrict authenticated users to their own company. New auth users trigger a new
company record and owner profile, so every signup starts with an empty tenant.

## Dashboard

The protected dashboard starts at `/` with the unified inbox module and includes
section routes for `/customers`, `/analytics`, `/conversions`, and `/settings`.
Fresh company setup support remains available in the dashboard shell for the
non-inbox sections.

Dashboard metrics are read from tenant-scoped Supabase tables. If a table is not
ready yet during setup, the dashboard keeps rendering with zero counts instead
of failing the page.

## Inbox

The inbox uses a responsive 3-panel layout:

- Left panel: conversation search, channel/status tabs, and conversation cards.
- Center panel: chat transcript, quick actions, manual composer, attachments,
  emoji, and send controls.
- Right panel: customer record, tags, notes, lead stage, AI auto reply, and
  conversion controls.

Each customer record includes an `ai_enabled` control. When AI is off, the inbox
shows `Human Mode Active — AI will not reply`, while keeping the owner composer
available for manual replies.

The inbox is seeded by a server-side, company-scoped snapshot and then
subscribes to Supabase Realtime `INSERT` events on `public.messages` with a
`company_id` filter. When a new message arrives for the logged-in user's
company, the client refreshes the conversation list and active chat window
through `/api/inbox/snapshot`, which derives the company from the authenticated
user profile instead of trusting client-supplied tenant IDs.

## Customers And Conversions

The Customers page supports search plus filters for platform, lead stage,
converted state, and month. Managers can mark a customer as converted from the
table; the server action updates the customer, and the Supabase trigger creates
the conversion record.

The Conversions page lists won conversion records, groups them by month, shows
platform statistics, and includes an export button placeholder for a later CSV
workflow.

## Analytics

The Analytics page reads Supabase data for the authenticated company only. It
shows cards for total conversations, new leads, converted customers, and
conversion rate, plus chart sections for monthly conversations, monthly
conversions, conversations by platform, and AI versus human mode. Empty tenants
see clean placeholders until enough activity exists for charts.

## Settings

The Settings page includes company profile, connected channels, Facebook,
Instagram, TikTok, AI settings, team members, notifications, webhook settings,
and API keys sections. Facebook and Instagram buttons start real Meta OAuth,
and connected channel cards are read from Supabase for the logged-in user's
company only.

## Meta Integration

Facebook and Instagram setup routes use Meta OAuth with Facebook Login:

- `GET /api/meta/connect/facebook` - starts Facebook OAuth.
- `GET /api/meta/connect/instagram` - starts Instagram Professional Account OAuth.
- `GET /api/meta/callback` - exchanges Meta's OAuth code for a user token,
  fetches `/me/accounts`, and redirects to page selection.
- `GET /settings/meta/select?session=...` - shows the available Facebook Pages.
- `POST /api/meta/pages/select` - saves the selected Page securely.

When `META_APP_ID` and `META_APP_SECRET` are configured, the connect routes
build a Meta OAuth URL using server-side env vars. If app credentials are
missing, the routes return a clear JSON configuration error.

The callback exchanges the OAuth `code` at Meta's `/oauth/access_token`
endpoint, exchanges the short-lived user token for a long-lived token, fetches
Pages from `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`,
and stores that result in `private.meta_oauth_sessions` for 15 minutes while the
user selects a Page.

For OAuth debugging, append `debug=1` or `debug=true` to the callback URL. In
debug mode, the callback returns the raw Meta
`GET https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`
JSON response, requested scopes, token debug information when Meta returns it,
and any Meta error object instead of redirecting to page selection.

After selection, TechSpd saves a Facebook row in `public.channels`:

- `page_id`
- `page_name`
- `page_access_token`

Those map to `company_id`, `platform = facebook`, `channel_id`, `channel_name`,
`access_token`, `connected_at`, and `is_connected`.

If the selected Facebook Page has a linked Instagram Professional Account,
TechSpd also saves a separate Instagram row with `platform = instagram`,
`channel_id = instagram_business_account_id`, `channel_name =
instagram_username`, the same Page access token, `connected_at`, and
`is_connected = true`.

Do not put client Page tokens in `.env.local`. Environment variables are only
for the TechSpd-owned Meta app credentials: `META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`, `META_GRAPH_VERSION`, `META_FACEBOOK_SCOPES`, and
`META_INSTAGRAM_SCOPES`.

## n8n Webhook

n8n can post social messages to:

```http
POST /api/webhooks/incoming-message
```

Use either header:

```http
Authorization: Bearer <N8N_WEBHOOK_SECRET>
x-techspd-webhook-secret: <N8N_WEBHOOK_SECRET>
```

Expected JSON body:

```json
{
  "company_id": "uuid",
  "platform": "facebook",
  "channel_id": "external-channel-id",
  "platform_user_id": "sender-id",
  "customer_name": "Customer Name",
  "message": "Message text",
  "attachment_url": "https://example.com/file.png",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

The route finds or creates the channel, customer, and conversation, saves the
incoming message, checks `customer.ai_enabled`, and returns:

```json
{
  "customer_id": "uuid",
  "conversation_id": "uuid",
  "ai_enabled": true
}
```

When `ai_enabled` is false, the message is saved and n8n should stop before the
AI reply workflow.

## Meta Webhook

Meta can verify and deliver Facebook Messenger or Instagram messaging events to:

```http
GET /api/webhooks/meta
POST /api/webhooks/meta
```

Set `META_WEBHOOK_VERIFY_TOKEN` in the server environment and use the same value
inside the Meta app webhook setup. The GET route reads `hub.mode`,
`hub.verify_token`, and `hub.challenge`; when the verify token matches, it
returns the raw challenge. Token mismatches return `403`.

The POST route accepts Meta webhook payloads, parses `entry[].messaging[]`,
detects Facebook versus Instagram from the webhook `object`, ignores echo
messages, finds the connected `public.channels` row by `platform` and
`channel_id`, creates the customer and conversation when needed, inserts a
customer message into `public.messages`, and updates
`conversations.last_message` plus `last_message_at`.

The route does not send AI replies or outbound Meta replies. It only stores the
incoming customer message and returns `200` quickly so n8n or another worker can
process the saved message later.

## Manual Owner Replies

Inbox owners can send manual replies through:

```http
POST /api/messages/send
```

Expected JSON body:

```json
{
  "conversation_id": "uuid",
  "customer_id": "uuid",
  "message": "Thanks, we can help with that."
}
```

The route authenticates the logged-in Supabase user, confirms the conversation
and customer belong to the same company, loads the connected channel, and sends
the message through Meta's Graph API using the channel `access_token` saved in
Supabase. It never reads customer Page tokens from `.env`.

Facebook and Instagram replies use the connected channel token. Facebook sends
through the saved Page ID. Instagram sends through the linked Facebook Page ID
stored on the Instagram channel settings when available, matching Meta's
`/<PAGE_ID>/messages` send endpoint.

After Meta accepts the message, TechSpd stores the reply in `public.messages`
with `sender_type = owner`, records the Meta message ID in metadata, and updates
`conversations.last_message` plus `last_message_at`. Owners can send manually
whether customer AI auto reply is on or off.

## n8n AI Integration

n8n can ask TechSpd whether a saved customer message should receive an AI reply:

```http
POST /api/n8n/process-message
```

Use this header:

```http
x-techspd-api-key: <TECHSPD_N8N_API_KEY>
```

Request body:

```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "customer_id": "uuid"
}
```

If the customer has AI disabled, TechSpd returns:

```json
{
  "should_reply": false,
  "reason": "AI disabled for this customer"
}
```

If AI is enabled, TechSpd returns the company, platform, customer, conversation,
channel, latest message, recent conversation history, and the saved
`channel_access_token` so n8n can generate the AI reply through OpenRouter and
send it back to Meta.

After n8n successfully sends the AI reply to Meta, it can persist the assistant
message in TechSpd:

```http
POST /api/n8n/save-ai-reply
```

Use the same `x-techspd-api-key` header. Request body:

```json
{
  "conversation_id": "uuid",
  "customer_id": "uuid",
  "ai_message": "AI reply text",
  "meta_message_id": "optional-meta-message-id"
}
```

The route saves the reply with `sender_type = ai`, records the optional Meta
message ID in metadata, updates `conversations.last_message` and
`last_message_at`, and returns success.
