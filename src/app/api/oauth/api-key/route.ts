import { NextRequest, NextResponse } from "next/server";
import { storeApiKey, OAUTH_PROVIDERS } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  const { userId, provider, workspaceId, apiKey, metadata } = await req.json();

  if (!userId || !provider || !apiKey || !workspaceId) {
    return NextResponse.json(
      { error: "Missing userId, provider, workspaceId, or apiKey" },
      { status: 400 }
    );
  }

  const config = OAUTH_PROVIDERS[provider];
  if (!config || config.type !== "api_key") {
    return NextResponse.json(
      { error: "Provider does not use API keys" },
      { status: 400 }
    );
  }

  try {
    await storeApiKey(userId, provider, workspaceId, apiKey, metadata ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`API key storage error for ${provider}:`, msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
