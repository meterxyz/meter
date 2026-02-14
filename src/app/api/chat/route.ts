import { NextRequest } from "next/server";
import OpenAI from "openai";

function getOpenRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

export async function POST(req: NextRequest) {
  const { messages, model } = await req.json();

  const response = await getOpenRouterClient().chat.completions.create({
    model: model || "anthropic/claude-sonnet-4-5-20250929",
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let totalTokensOut = 0;

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

        // Final usage stats
        if (chunk.usage) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "usage",
                tokensIn: chunk.usage.prompt_tokens,
                tokensOut: chunk.usage.completion_tokens,
              })}\n\n`
            )
          );
        }
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
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
}

// Rough token estimate for streaming (before final usage comes back)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
