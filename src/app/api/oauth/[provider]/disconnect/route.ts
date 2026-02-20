import { NextRequest, NextResponse } from "next/server";
import { deleteToken } from "@/lib/oauth";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const { userId, workspaceId } = await req.json();

  if (!userId || !workspaceId) {
    return NextResponse.json({ error: "Missing userId or workspaceId" }, { status: 400 });
  }

  await deleteToken(userId, providerId, workspaceId);

  // Backward compat: update gmail_connected field
  if (providerId === "gmail") {
    const supabase = getSupabaseServer();
    await supabase
      .from("meter_users")
      .update({ gmail_connected: false })
      .eq("id", userId);
  }

  return NextResponse.json({ ok: true });
}
