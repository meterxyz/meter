import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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
