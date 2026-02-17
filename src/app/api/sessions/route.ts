import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// GET /api/sessions?userId=xxx — load all sessions + messages for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();

    const { data: sessions, error: sessErr } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (sessErr) throw sessErr;

    // Load messages for each session
    const sessionIds = (sessions ?? []).map((s) => s.id);
    const { data: messages, error: msgErr } = sessionIds.length
      ? await supabase
          .from("chat_messages")
          .select("*")
          .in("session_id", sessionIds)
          .order("timestamp", { ascending: true })
      : { data: [], error: null };

    if (msgErr) throw msgErr;

    // Group messages by session
    const allMessages = (messages ?? []) as Record<string, unknown>[];
    const messagesBySession: Record<string, Record<string, unknown>[]> = {};
    for (const msg of allMessages) {
      const sid = msg.session_id as string;
      if (!messagesBySession[sid]) messagesBySession[sid] = [];
      messagesBySession[sid].push(msg);
    }

    const result = (sessions ?? []).map((s) => ({
      ...s,
      messages: messagesBySession[s.id] ?? [],
    }));

    return NextResponse.json({ sessions: result });
  } catch (err) {
    console.error("Failed to load sessions:", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

// POST /api/sessions — save/sync a session with its messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, session, messages } = body;

    if (!userId || !session) {
      return NextResponse.json({ error: "Missing userId or session" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Upsert the session
    const { error: sessErr } = await supabase.from("chat_sessions").upsert(
      {
        id: session.id,
        user_id: userId,
        project_name: session.name,
        total_cost: session.totalCost ?? 0,
        today_cost: session.todayCost ?? 0,
        today_tokens_in: session.todayTokensIn ?? 0,
        today_tokens_out: session.todayTokensOut ?? 0,
        today_message_count: session.todayMessageCount ?? 0,
        today_date: session.todayDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (sessErr) throw sessErr;

    // Upsert messages in batches
    if (messages && messages.length > 0) {
      const rows = messages.map((m: Record<string, unknown>) => ({
        id: m.id,
        session_id: session.id,
        role: m.role,
        content: m.content ?? "",
        model: m.model ?? null,
        tokens_in: m.tokensIn ?? null,
        tokens_out: m.tokensOut ?? null,
        cost: m.cost ?? null,
        confidence: m.confidence ?? null,
        settled: m.settled ?? false,
        receipt_status: m.receiptStatus ?? null,
        signature: m.signature ?? null,
        tx_hash: m.txHash ?? null,
        cards: m.cards ?? null,
        timestamp: m.timestamp,
      }));

      // Batch upsert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error: msgErr } = await supabase
          .from("chat_messages")
          .upsert(chunk, { onConflict: "id" });
        if (msgErr) throw msgErr;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save session:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
