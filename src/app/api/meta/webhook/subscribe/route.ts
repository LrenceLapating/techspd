import { NextResponse } from "next/server";
import {
  getAuthenticatedMetaCompany,
  subscribeConnectedFacebookWebhook,
  subscribeConnectedInstagramWebhook,
} from "@/lib/meta/integration";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await getAuthenticatedMetaCompany(supabase);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      platform?: unknown;
    } | null;
    const platform = body?.platform === "instagram" ? "instagram" : "facebook";
    const subscription =
      platform === "instagram"
        ? await subscribeConnectedInstagramWebhook({ companyId: auth.companyId })
        : await subscribeConnectedFacebookWebhook({ companyId: auth.companyId });

    return NextResponse.json({
      channel_id: subscription.channelId,
      page_id: subscription.pageId,
      platform,
      response: subscription.response,
      webhook_subscribed: true,
      webhook_subscribed_at: subscription.subscribedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe Meta webhook.",
        meta_error:
          error &&
          typeof error === "object" &&
          "metaError" in error
            ? error.metaError
            : null,
      },
      {
        status:
          error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : 500,
      },
    );
  }
}
