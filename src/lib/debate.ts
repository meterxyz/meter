/**
 * Meter 1.0 Debate Mode — multi-model deliberation engine.
 *
 * Runs three frontier models (Opus 4.6, GPT-5.2, Gemini 3 Pro) through
 * a structured debate, then synthesizes a consensus answer.
 *
 * Phases:
 *   1. Opening — each model gives its position
 *   2. Challenge — each model critiques the others
 *   3. Synthesis — Sonnet 4.6 produces a final balanced answer
 */

import { streamWithFallback, type Send } from "./fallback";
import { DEBATE_MODELS, shortModelName } from "./models";
import type OpenAI from "openai";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function runDebate(
  conversation: Message[],
  send: Send,
) {
  const positions: Record<string, string> = {};
  const challenges: Record<string, string> = {};
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  // Extract the user's question (last user message in conversation)
  const userMessages = conversation.filter((m) => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1];
  const topic = typeof lastUserMsg?.content === "string"
    ? lastUserMsg.content
    : "the topic under discussion";

  send({ type: "debate_start" });

  // ── Phase 1: Opening positions ──────────────────────────────────
  for (const modelId of DEBATE_MODELS) {
    send({ type: "debate_turn_start", model: modelId, phase: "opening" });

    const openingConvo: Message[] = [
      {
        role: "system",
        content: `You are participating in a structured multi-model debate. Give your honest, specific position on the user's question. Be direct, insightful, and concise — 2-3 short paragraphs max. Do not hedge or disclaim. Take a clear stance.`,
      },
      // Include conversation context so the model understands the full discussion
      ...conversation.filter((m) => m.role !== "system"),
    ];

    let turnContent = "";
    let roundIn = 0;
    let roundOut = 0;

    const turnSend: Send = (data) => {
      if (data.type === "delta") {
        turnContent += data.content as string;
        send({ type: "debate_turn_delta", content: data.content, model: modelId });
      }
      if (data.type === "usage") {
        roundIn = (data.tokensIn as number) || 0;
        roundOut = (data.tokensOut as number) || 0;
      }
    };

    const totalOut = { value: 0 };
    try {
      await streamWithFallback(modelId, openingConvo, [], turnSend, estimateTokens, totalOut);
    } catch {
      turnContent = "(This model was unavailable for this round.)";
    }

    totalTokensIn += roundIn;
    totalTokensOut += roundOut;
    positions[modelId] = turnContent;
    send({ type: "debate_turn_end", model: modelId, phase: "opening" });
  }

  // ── Phase 2: Cross-examination ──────────────────────────────────
  for (const modelId of DEBATE_MODELS) {
    const otherPositions = DEBATE_MODELS
      .filter((id) => id !== modelId)
      .map((id) => `**${shortModelName(id)}:** ${positions[id]}`)
      .join("\n\n");

    send({ type: "debate_turn_start", model: modelId, phase: "challenge" });

    const challengeConvo: Message[] = [
      {
        role: "system",
        content: `You are in round 2 of a structured multi-model debate.

Your opening position was:
${positions[modelId]}

The other participants said:
${otherPositions}

Now push back. Challenge weak reasoning, identify blind spots, stress-test assumptions. Defend your view where it differs but concede where others make stronger points. Be constructive but rigorous. 2-3 short paragraphs.`,
      },
      ...conversation.filter((m) => m.role !== "system"),
    ];

    let challengeContent = "";
    let roundIn = 0;
    let roundOut = 0;

    const challengeSend: Send = (data) => {
      if (data.type === "delta") {
        challengeContent += data.content as string;
        send({ type: "debate_turn_delta", content: data.content, model: modelId });
      }
      if (data.type === "usage") {
        roundIn = (data.tokensIn as number) || 0;
        roundOut = (data.tokensOut as number) || 0;
      }
    };

    const totalOut2 = { value: 0 };
    try {
      await streamWithFallback(modelId, challengeConvo, [], challengeSend, estimateTokens, totalOut2);
    } catch {
      challengeContent = "(This model was unavailable for this round.)";
    }

    totalTokensIn += roundIn;
    totalTokensOut += roundOut;
    challenges[modelId] = challengeContent;
    send({ type: "debate_turn_end", model: modelId, phase: "challenge" });
  }

  // ── Phase 3: Synthesis ──────────────────────────────────────────
  const fullDebate = DEBATE_MODELS.map((id) => {
    const name = shortModelName(id);
    return `### ${name}\n**Opening:** ${positions[id]}\n\n**Challenge:** ${challenges[id]}`;
  }).join("\n\n---\n\n");

  const synthesisConvo: Message[] = [
    {
      role: "system",
      content: `You are Meter 1.0, a synthesis engine that produces balanced, well-reasoned answers from multi-model debates.

Three frontier AI models (${DEBATE_MODELS.map(shortModelName).join(", ")}) debated the following topic:
"${topic}"

Here is the full debate:

${fullDebate}

Synthesize the strongest arguments from all sides. Where the models agree, state the consensus clearly. Where they disagree, explain the trade-offs honestly. Produce a clear, direct, actionable final answer. Write in plain prose — avoid excessive bullet lists. Be concise.`,
    },
    ...conversation.filter((m) => m.role !== "system"),
  ];

  send({ type: "debate_synthesis_start" });

  let synthRoundIn = 0;
  let synthRoundOut = 0;

  const synthSend: Send = (data) => {
    if (data.type === "delta") {
      // Forward as regular delta so the client renders it as the main message
      send(data);
    }
    if (data.type === "usage") {
      synthRoundIn = (data.tokensIn as number) || 0;
      synthRoundOut = (data.tokensOut as number) || 0;
    }
  };

  const totalOut3 = { value: 0 };
  // Use Sonnet for synthesis — capable and cost-effective
  await streamWithFallback(
    "anthropic/claude-sonnet-4.6",
    synthesisConvo,
    [],
    synthSend,
    estimateTokens,
    totalOut3,
  );

  totalTokensIn += synthRoundIn;
  totalTokensOut += synthRoundOut;

  // Send aggregated usage across all debate rounds + synthesis
  send({ type: "usage", tokensIn: totalTokensIn, tokensOut: totalTokensOut });
  send({ type: "done", actualModel: "meter-1.0" });
}
