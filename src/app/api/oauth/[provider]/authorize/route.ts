import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import {
  OAUTH_PROVIDERS,
  generateState,
  buildAuthorizeUrl,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerId } = await params;
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider || provider.type !== "oauth") {
      return NextResponse.json({ error: "Invalid OAuth provider" }, { status: 400 });
    }

    const state = generateState();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://meter.chat";
    const redirectUri = `${appUrl}/api/oauth/${providerId}/callback`;

    // Store state for CSRF validation
    const supabase = getSupabaseServer();
    await supabase.from("oauth_state").insert({
      id: state,
      user_id: userId,
      provider: providerId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    });

    const authorizeUrl = buildAuthorizeUrl(provider, state, redirectUri);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("OAuth authorize error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
