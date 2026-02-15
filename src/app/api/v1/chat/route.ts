import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function authenticateApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer mk_")) {
    return null;
  }

  const apiKey = auth.slice(7); // strip "Bearer "
  const keyHash = hashKey(apiKey);
  const supabase = getSupabase();

  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("id, user_id, active")
    .eq("key_hash", keyHash)
    .single();

  if (!keyRecord || !keyRecord.active) {
    return null;
  }

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  return keyRecord;
}

export async function POST(req: NextRequest) {
  const keyRecord = await authenticateApiKey(req);
  if (!keyRecord) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const { messages, model } = await req.json();

  const response = await getOpenRouterClient().chat.completions.create({
    model: model || "anthropic/claude-opus-4.6",
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();
  const supabase = getSupabase();
  const userId = keyRecord.user_id;
  const keyId = keyRecord.id;

  const stream = new ReadableStream({
    async start(controller) {
      let totalTokensOut = 0;
      let finalTokensIn = 0;
      let finalTokensOut = 0;

      for await (const chunk of response) {
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          totalTokensOut += estimateTokens(delta);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "delta", content: delta, tokensOut: totalTokensOut })}\n\n`
            )
          );
        }

        if (chunk.usage) {
          finalTokensIn = chunk.usage.prompt_tokens;
          finalTokensOut = chunk.usage.completion_tokens;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "usage",
                tokensIn: finalTokensIn,
                tokensOut: finalTokensOut,
              })}\n\n`
            )
          );
        }
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
      );
      controller.close();

      // Record usage asynchronously
      await supabase.from("usage_records").insert({
        user_id: userId,
        api_key_id: keyId,
        model: model || "anthropic/claude-opus-4.6",
        tokens_in: finalTokensIn,
        tokens_out: finalTokensOut,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
