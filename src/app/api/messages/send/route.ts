import { NextResponse } from "next/server";
import {
  manualReplyErrorResponse,
  parseManualReplyBody,
  sendManualReply,
} from "@/lib/messages/manual-reply";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload;

  try {
    payload = parseManualReplyBody(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const result = await sendManualReply({ payload, supabase });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[manual-reply] Send failed.", { error });

    const response = manualReplyErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
