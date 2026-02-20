import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("chat_sessions")
      .select("daily_limit, monthly_limit, per_txn_limit")
      .eq("id", workspaceId)
      .eq("user_id", userId)
      .single();

    return NextResponse.json({
      dailyLimit: data?.daily_limit ?? null,
      monthlyLimit: data?.monthly_limit ?? null,
      perTxnLimit: data?.per_txn_limit ?? null,
    });
  } catch {
    return NextResponse.json({ dailyLimit: null, monthlyLimit: null, perTxnLimit: null });
  }
}

export async function PUT(req: NextRequest) {
  const putAuth = await requireAuth();
  if (putAuth instanceof NextResponse) return putAuth;
  const { userId: putUserId } = putAuth;

  try {
    const { workspaceId, dailyLimit, monthlyLimit, perTxnLimit } = await req.json();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const userId = putUserId;

    const supabase = getSupabaseServer();
    await supabase
      .from("chat_sessions")
      .update({
        daily_limit: dailyLimit ?? null,
        monthly_limit: monthlyLimit ?? null,
        per_txn_limit: perTxnLimit ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workspaceId)
      .eq("user_id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
