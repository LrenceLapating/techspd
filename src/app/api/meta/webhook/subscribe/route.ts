import { NextResponse } from "next/server";
import {
  getAuthenticatedMetaCompany,
  subscribeConnectedFacebookWebhook,
} from "@/lib/meta/integration";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const auth = await getAuthenticatedMetaCompany(supabase);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const subscription = await subscribeConnectedFacebookWebhook({
      companyId: auth.companyId,
    });

    return NextResponse.json({
      channel_id: subscription.channelId,
      page_id: subscription.pageId,
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
            : "Unable to subscribe Facebook Page webhook.",
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
