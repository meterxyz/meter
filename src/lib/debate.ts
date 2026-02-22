/**
 * Meter 1.0 Debate Mode — multi-model deliberation engine.
 *
 * Runs three frontier models (Opus 4.6, GPT-5.2, Gemini 3 Pro) through
 * a structured debate, then picks the winning position with conviction.
 *
 * Phases:
 *   1. Opening — each model gives its position
 *   2. Challenge — each model critiques the others
 *   3. Rebuttal (0-2 rounds) — continue if no consensus; models defend/concede
 *   4. Verdict — identify which original position won, commit with conviction
 */

import { streamWithFallback, type Send } from "./fallback";
import { DEBATE_MODELS, shortModelName } from "./models";
import type OpenAI from "openai";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const MAX_DEBATE_ROUNDS = 4; // opening + challenge + up to 2 rebuttals

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Run a single model turn — stream to client, collect text + usage */
async function runModelTurn(
  modelId: string,
  messages: Message[],
  phase: string,
  send: Send,
  usage: { tokensIn: number; tokensOut: number },
): Promise<string> {
  send({ type: "debate_turn_start", model: modelId, phase });

  let content = "";
  let roundIn = 0;
  let roundOut = 0;

  const turnSend: Send = (data) => {
    if (data.type === "delta") {
      content += data.content as string;
      send({ type: "debate_turn_delta", content: data.content, model: modelId });
    }
    if (data.type === "usage") {
      roundIn = (data.tokensIn as number) || 0;
      roundOut = (data.tokensOut as number) || 0;
    }
  };

  const totalOut = { value: 0 };
  try {
    await streamWithFallback(modelId, messages, [], turnSend, estimateTokens, totalOut);
  } catch {
    content = "(This model was unavailable for this round.)";
  }

  usage.tokensIn += roundIn;
  usage.tokensOut += roundOut;
  send({ type: "debate_turn_end", model: modelId, phase });

  return content;
}

/** Non-streaming call to check convergence — returns the model id that "won", or null */
async function checkConvergence(
  topic: string,
  debateHistory: string,
  usage: { tokensIn: number; tokensOut: number },
): Promise<string | null> {
  const messages: Message[] = [
    {
      role: "system",
      content: `You are a debate judge. Analyze whether the participants have converged on a single position.

The topic: "${topic}"

Debate so far:
${debateHistory}

Have the models converged on one original position? A position "wins" when:
- The other models have conceded key points to it, OR
- The challenges against it were weak or were effectively rebutted, OR
- Multiple models are now essentially restating the same position

Reply with EXACTLY one of:
- "CONVERGED: model_id" where model_id is the identifier of the model whose original position won (copy it exactly from the debate)
- "NO_CONSENSUS" if positions are still genuinely split

Do not explain. Just the verdict.`,
    },
  ];

  let result = "";
  let roundIn = 0;
  let roundOut = 0;

  const judgeSend: Send = (data) => {
    if (data.type === "delta") result += data.content as string;
    if (data.type === "usage") {
      roundIn = (data.tokensIn as number) || 0;
      roundOut = (data.tokensOut as number) || 0;
    }
  };

  const totalOut = { value: 0 };
  // Use a fast model for the convergence check
  await streamWithFallback(
    "anthropic/claude-sonnet-4.6",
    messages,
    [],
    judgeSend,
    estimateTokens,
    totalOut,
  );

  usage.tokensIn += roundIn;
  usage.tokensOut += roundOut;

  const trimmed = result.trim();
  if (trimmed.startsWith("CONVERGED:")) {
    const winnerId = trimmed.replace("CONVERGED:", "").trim();
    // Validate it's actually one of our debate models
    const match = DEBATE_MODELS.find(
      (id) => id === winnerId || shortModelName(id) === winnerId,
    );
    return match ?? null;
  }
  return null;
}

/** Format the full debate history so far into a readable string */
function formatDebateHistory(
  rounds: { phase: string; positions: Record<string, string> }[],
): string {
  return rounds
    .map((round) => {
      const header = round.phase.charAt(0).toUpperCase() + round.phase.slice(1);
      const entries = DEBATE_MODELS.map(
        (id) => `**${shortModelName(id)}:** ${round.positions[id] || "(unavailable)"}`,
      ).join("\n\n");
      return `## ${header}\n${entries}`;
    })
    .join("\n\n---\n\n");
}

export async function runDebate(conversation: Message[], send: Send) {
  const usage = { tokensIn: 0, tokensOut: 0 };

  // Extract the user's question
  const userMessages = conversation.filter((m) => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1];
  const topic =
    typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : "the topic under discussion";

  const conversationContext = conversation.filter((m) => m.role !== "system");

  // Track all rounds for history
  const rounds: { phase: string; positions: Record<string, string> }[] = [];

  send({ type: "debate_start" });

  // ── Phase 1: Opening positions ──────────────────────────────────
  const openingPositions: Record<string, string> = {};

  for (const modelId of DEBATE_MODELS) {
    const messages: Message[] = [
      {
        role: "system",
        content: `You are participating in a structured multi-model debate. Give your honest, specific position on the user's question. Be direct, insightful, and concise — 2-3 short paragraphs max. Do not hedge or disclaim. Take a clear stance.`,
      },
      ...conversationContext,
    ];

    openingPositions[modelId] = await runModelTurn(
      modelId, messages, "opening", send, usage,
    );
  }

  rounds.push({ phase: "opening", positions: openingPositions });

  // ── Phase 2+: Challenge / Rebuttal rounds ───────────────────────
  let winnerModelId: string | null = null;
  let roundNum = 1; // round 1 = challenge, round 2+ = rebuttal

  while (roundNum < MAX_DEBATE_ROUNDS) {
    const phase = roundNum === 1 ? "challenge" : "rebuttal";
    const roundPositions: Record<string, string> = {};
    const prevRound = rounds[rounds.length - 1];

    for (const modelId of DEBATE_MODELS) {
      const otherPositions = DEBATE_MODELS
        .filter((id) => id !== modelId)
        .map(
          (id) =>
            `**${shortModelName(id)}:** ${prevRound.positions[id] || "(unavailable)"}`,
        )
        .join("\n\n");

      const myHistory = rounds
        .map((r) => `[${r.phase}]: ${r.positions[modelId] || ""}`)
        .join("\n\n");

      const systemContent =
        roundNum === 1
          ? `You are in the challenge round of a structured multi-model debate.

Your opening position was:
${openingPositions[modelId]}

The other participants said:
${otherPositions}

Push back hard. Challenge weak reasoning, identify blind spots, stress-test assumptions. Defend your view where it differs. If another model's position is genuinely stronger on a point, acknowledge it — but don't cave just to be agreeable. Hold your ground where you're right. 2-3 short paragraphs.`
          : `You are in rebuttal round ${roundNum - 1} of a structured multi-model debate.

Your positions so far:
${myHistory}

The other participants' latest responses:
${otherPositions}

This debate continues because genuine disagreement remains. Either:
- Defend your position against the specific challenges raised, with stronger evidence or reasoning
- OR concede to the position that has proven stronger — don't split the difference, pick a side

Do NOT compromise or blend positions. Either your original stance holds up under pressure, or it doesn't. Be honest about which it is. 2-3 short paragraphs.`;

      const messages: Message[] = [
        { role: "system", content: systemContent },
        ...conversationContext,
      ];

      roundPositions[modelId] = await runModelTurn(
        modelId, messages, phase, send, usage,
      );
    }

    rounds.push({ phase, positions: roundPositions });
    roundNum++;

    // Check convergence after this round
    const debateHistory = formatDebateHistory(rounds);
    winnerModelId = await checkConvergence(topic, debateHistory, usage);

    if (winnerModelId) break;
  }

  // ── Final: Verdict with conviction ──────────────────────────────
  const fullDebate = formatDebateHistory(rounds);
  const winnerName = winnerModelId ? shortModelName(winnerModelId) : null;
  const winnerOpening = winnerModelId ? openingPositions[winnerModelId] : null;

  const verdictPrompt = winnerModelId
    ? `You are Meter 1.0, a verdict engine that delivers clear, convicted answers from multi-model debates.

Three frontier AI models (${DEBATE_MODELS.map(shortModelName).join(", ")}) debated:
"${topic}"

Here is the full debate:

${fullDebate}

The debate converged on ${winnerName}'s position. Their original stance:
${winnerOpening}

Your job: Present this winning position as the definitive answer. Write with full conviction — this position survived rigorous cross-examination from frontier AI models. Explain briefly why the other positions were weaker (1-2 sentences each), then deliver the answer clearly and directly.

Do NOT hedge, blend, or water down the winning position. This is the answer that held up under pressure. Write in plain prose, be concise and actionable.`
    : `You are Meter 1.0, a verdict engine that delivers clear, convicted answers from multi-model debates.

Three frontier AI models (${DEBATE_MODELS.map(shortModelName).join(", ")}) debated:
"${topic}"

Here is the full debate:

${fullDebate}

No single position achieved clear consensus after ${rounds.length} rounds. Analyze which original position held up best under pressure — which one had the fewest successful challenges against it, and whose core argument remained intact?

Pick that position and present it as the answer with conviction. You MUST choose one — do not synthesize a compromise or blend of positions. The whole point of this debate is to stress-test ideas and commit to the strongest one, not to produce a wishy-washy middle ground.

Briefly explain why you picked this position over the others (1-2 sentences each), then deliver the answer clearly and directly. Write in plain prose, be concise and actionable.`;

  const synthesisConvo: Message[] = [
    { role: "system", content: verdictPrompt },
    ...conversationContext,
  ];

  send({ type: "debate_synthesis_start" });

  let synthRoundIn = 0;
  let synthRoundOut = 0;

  const synthSend: Send = (data) => {
    if (data.type === "delta") send(data);
    if (data.type === "usage") {
      synthRoundIn = (data.tokensIn as number) || 0;
      synthRoundOut = (data.tokensOut as number) || 0;
    }
  };

  const totalOut = { value: 0 };
  await streamWithFallback(
    "anthropic/claude-sonnet-4.6",
    synthesisConvo,
    [],
    synthSend,
    estimateTokens,
    totalOut,
  );

  usage.tokensIn += synthRoundIn;
  usage.tokensOut += synthRoundOut;

  send({ type: "usage", tokensIn: usage.tokensIn, tokensOut: usage.tokensOut });
  send({ type: "done", actualModel: "meter-1.0" });
}
