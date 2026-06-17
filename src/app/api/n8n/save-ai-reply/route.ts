import { NextResponse } from "next/server";
import {
  isAuthorizedN8nRequest,
  n8nAiErrorResponse,
  parseSaveAiReplyBody,
  saveAiReply,
} from "@/lib/n8n/ai-integration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedN8nRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;

  try {
    payload = parseSaveAiReplyBody(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const result = await saveAiReply(payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[n8n-ai] Save AI reply failed.", { error });

    const response = n8nAiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
