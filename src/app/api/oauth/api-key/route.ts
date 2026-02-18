import { NextRequest, NextResponse } from "next/server";
import { storeApiKey, OAUTH_PROVIDERS } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  const { userId, provider, apiKey } = await req.json();

  if (!userId || !provider || !apiKey) {
    return NextResponse.json(
      { error: "Missing userId, provider, or apiKey" },
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
    await storeApiKey(userId, provider, apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`API key storage error for ${provider}:`, err);
    return NextResponse.json(
      { error: "Failed to store API key" },
      { status: 500 }
    );
  }
}
