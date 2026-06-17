import { NextResponse } from "next/server";
import {
  isAuthorizedN8nRequest,
  n8nAiErrorResponse,
  parseProcessMessageBody,
  processMessageForN8n,
} from "@/lib/n8n/ai-integration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedN8nRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;

  try {
    payload = parseProcessMessageBody(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const result = await processMessageForN8n(payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[n8n-ai] Process message failed.", { error });

    const response = n8nAiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
