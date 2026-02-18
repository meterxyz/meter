import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getToolsForConnectors, buildSystemPrompt, executeTool } from "@/lib/tools";

function getOpenRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, model, userId, projectId, connectedServices } = await req.json();
    const connectedIds: string[] = Array.isArray(connectedServices) ? connectedServices : [];
    const resolvedModel = !model || model === "auto" ? "anthropic/claude-sonnet-4" : model;
    const openrouter = getOpenRouterClient();
    const encoder = new TextEncoder();
    const tools = getToolsForConnectors(connectedIds);
    const systemPrompt = buildSystemPrompt(connectedIds);

    // Build conversation with system prompt
    const conversation: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let totalTokensOut = 0;

        try {
          for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            const response = await openrouter.chat.completions.create({
              model: resolvedModel,
              messages: conversation,
              tools,
              stream: true,
              stream_options: { include_usage: true },
            });

            let textContent = "";
            const toolCalls = new Map<
              number,
              { id: string; name: string; arguments: string }
            >();
            let hasToolCalls = false;

            for await (const chunk of response) {
              const choice = chunk.choices?.[0];
              if (!choice) {
                // Usage-only chunk (no choices)
                if (chunk.usage) {
                  send({
                    type: "usage",
                    tokensIn: chunk.usage.prompt_tokens,
                    tokensOut: chunk.usage.completion_tokens,
                  });
                }
                continue;
              }

              // Stream text content to client immediately
              const delta = choice.delta?.content || "";
              if (delta) {
                textContent += delta;
                totalTokensOut += estimateTokens(delta);
                send({ type: "delta", content: delta, tokensOut: totalTokensOut });
              }

              // Accumulate tool calls from deltas
              if (choice.delta?.tool_calls) {
                hasToolCalls = true;
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCalls.get(tc.index) || {
                    id: "",
                    name: "",
                    arguments: "",
                  };
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                  toolCalls.set(tc.index, existing);
                }
              }

              // Usage info
              if (chunk.usage) {
                send({
                  type: "usage",
                  tokensIn: chunk.usage.prompt_tokens,
                  tokensOut: chunk.usage.completion_tokens,
                });
              }
            }

            // No tool calls → done
            if (!hasToolCalls || toolCalls.size === 0) break;

            // Add assistant message with tool calls to conversation
            conversation.push({
              role: "assistant",
              content: textContent || null,
              tool_calls: Array.from(toolCalls.values()).map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            // Execute each tool call
            for (const tc of toolCalls.values()) {
              // Notify client about tool usage
              send({ type: "tool_call", name: tc.name });

              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.arguments);
              } catch {
                // malformed args — pass empty
              }

              const result = await executeTool(tc.name, args, { userId, projectId });

              // Send tool result with args for client-side state sync
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

              // Add tool result to conversation
              conversation.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              });
            }

            // Loop continues — model will see tool results and respond
          }
        } catch (streamErr) {
          const err = streamErr as Error & {
            status?: number;
            code?: string;
            type?: string;
            headers?: Headers;
            error?: Record<string, unknown>;
          };

          console.error("[chat stream error]", {
            status: err.status,
            code: err.code,
            type: err.type,
            message: err.message,
            error: err.error,
          });

          // Broad rate limit detection — check status, code, type, message, and nested error body
          const errorStr = JSON.stringify(err.error ?? "").toLowerCase();
          const msgStr = (err.message ?? "").toLowerCase();
          const isRateLimit =
            err.status === 429 ||
            err.code === "rate_limit_exceeded" ||
            err.type === "rate_limit_error" ||
            /rate.?limit|too many request|quota|throttl|capacity|overloaded/i.test(msgStr) ||
            /rate.?limit|too many request|quota|throttl|capacity|overloaded/i.test(errorStr);

          // Extract retry/reset timing from headers or error body
          let retryAfter: string | null = null;
          if (err.headers) {
            retryAfter =
              err.headers.get("retry-after") ||
              err.headers.get("x-ratelimit-reset") ||
              err.headers.get("x-ratelimit-reset-requests") ||
              err.headers.get("x-ratelimit-reset-tokens") ||
              null;
          }
          // Also check nested error body for reset info
          if (!retryAfter && err.error) {
            const metadata = err.error.metadata as Record<string, unknown> | undefined;
            if (metadata?.retry_after) retryAfter = String(metadata.retry_after);
            if (metadata?.reset) retryAfter = String(metadata.reset);
          }

          // Extract provider name from model id (e.g. "anthropic/claude-opus-4" → "Anthropic")
          const provider = resolvedModel.includes("/")
            ? resolvedModel.split("/")[0].charAt(0).toUpperCase() + resolvedModel.split("/")[0].slice(1)
            : null;

          send({
            type: "error",
            code: isRateLimit ? "rate_limit" : "unknown",
            model: resolvedModel,
            provider,
            retryAfter,
            message: err.message,
          });
        }

        send({ type: "done" });
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
