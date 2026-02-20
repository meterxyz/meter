import { NextRequest, NextResponse } from "next/server";
import { getToolsForConnectors, buildSystemPrompt, executeTool } from "@/lib/tools";
import { streamWithFallback, type Send } from "@/lib/fallback";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import type OpenAI from "openai";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  // At least one provider must be configured
  if (!process.env.OPENROUTER_API_KEY && !process.env.CLAUDE_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "No API keys configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const { messages, model, projectId, connectedServices } = await req.json();

    // Server-side spend limit enforcement
    if (projectId) {
      const limitCheck = await checkSpendLimits(userId, projectId);
      if (limitCheck) {
        return new Response(
          JSON.stringify({ error: limitCheck }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const connectedIds: string[] = Array.isArray(connectedServices) ? connectedServices : [];
    const resolvedModel = !model || model === "auto" ? "anthropic/claude-sonnet-4.6" : model;
    const encoder = new TextEncoder();
    const tools = getToolsForConnectors(connectedIds);
    const systemPrompt = buildSystemPrompt(connectedIds);

    const conversation: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const send: Send = (data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const totalTokensOut = { value: 0 };
        let activeModel = resolvedModel;

        try {

          for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            const result = await streamWithFallback(
              activeModel,
              conversation,
              tools,
              send,
              estimateTokens,
              totalTokensOut,
            );

            // Track which model actually responded (for subsequent tool rounds)
            activeModel = result.actualModel;

            // No tool calls → done
            if (!result.hasToolCalls || result.toolCalls.size === 0) break;

            // Add assistant message with tool calls to conversation
            conversation.push({
              role: "assistant",
              content: result.textContent || null,
              tool_calls: Array.from(result.toolCalls.values()).map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            // Execute each tool call
            for (const tc of result.toolCalls.values()) {
              send({ type: "tool_call", name: tc.name });

              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.arguments);
              } catch {
                // malformed args — pass empty
              }

              const toolResult = await executeTool(tc.name, args, { userId, projectId });

              const toolResultEvent: Record<string, unknown> = { type: "tool_result", name: tc.name };
              if (tc.name === "save_decision") {
                toolResultEvent.decision = {
                  title: args.title,
                  status: "decided",
                  choice: args.choice,
                  alternatives: args.alternatives || [],
                  reasoning: args.reasoning || null,
                };
              }
              send(toolResultEvent);

              conversation.push({
                role: "tool",
                tool_call_id: tc.id,
                content: toolResult,
              });
            }
          }
        } catch (err) {
          // All fallback tiers exhausted — show error to client
          console.error("[chat] all providers failed:", (err as Error).message);

          send({
            type: "error",
            code: "all_providers_failed",
            model: resolvedModel,
          });
        }

        send({ type: "done", actualModel: activeModel });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[/api/chat]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function checkSpendLimits(userId: string, projectId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServer();
    const scopedId = projectId.startsWith(`${userId}:`) ? projectId : `${userId}:${projectId}`;
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("daily_limit, monthly_limit, today_cost, total_cost")
      .eq("id", scopedId)
      .eq("user_id", userId)
      .single();

    if (!session) return null;
    const dailyLimit = session.daily_limit != null ? Number(session.daily_limit) : null;
    const monthlyLimit = session.monthly_limit != null ? Number(session.monthly_limit) : null;
    if (dailyLimit === null && monthlyLimit === null) return null;

    if (dailyLimit !== null) {
      const todayCost = Number(session.today_cost) || 0;
      if (todayCost >= dailyLimit) {
        return `Daily spend limit reached ($${todayCost.toFixed(2)} / $${dailyLimit.toFixed(2)})`;
      }
    }

    if (monthlyLimit !== null) {
      const totalCost = Number(session.total_cost) || 0;
      if (totalCost >= monthlyLimit) {
        return `Monthly spend limit reached ($${totalCost.toFixed(2)} / $${monthlyLimit.toFixed(2)})`;
      }
    }

    return null;
  } catch {
    return null;
  }
}
