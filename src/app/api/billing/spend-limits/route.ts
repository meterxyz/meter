import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("meter_users")
      .select("daily_limit, monthly_limit, per_txn_limit")
      .eq("id", userId)
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
  try {
    const { userId, dailyLimit, monthlyLimit, perTxnLimit } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    await supabase
      .from("meter_users")
      .update({
        daily_limit: dailyLimit ?? null,
        monthly_limit: monthlyLimit ?? null,
        per_txn_limit: perTxnLimit ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
