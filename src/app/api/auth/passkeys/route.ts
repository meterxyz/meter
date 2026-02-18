import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("passkey_credentials")
      .select("credential_id, device_type, backed_up, created_at")
      .eq("user_id", userId);

    if (error) {
      console.error("Passkeys fetch error:", error);
      return NextResponse.json({ passkeys: [] });
    }

    const passkeys = (data ?? []).map((r: Record<string, unknown>) => ({
      credentialId: r.credential_id,
      deviceType: r.device_type ?? null,
      backedUp: r.backed_up ?? false,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ passkeys });
  } catch {
    return NextResponse.json({ passkeys: [] });
  }
}
