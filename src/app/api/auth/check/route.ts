import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// POST /api/auth/check — check if email exists (has passkeys)
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: user } = await supabase
      .from("meter_users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    // Check if user has any passkey credentials
    const { data: creds } = await supabase
      .from("passkey_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    return NextResponse.json({
      exists: true,
      hasPasskey: (creds ?? []).length > 0,
      userId: user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Auth check error:", message);
    return NextResponse.json(
      { error: message.includes("relation") ? "Database tables not set up. Visit /api/setup-db first." : message },
      { status: 500 }
    );
  }
}
