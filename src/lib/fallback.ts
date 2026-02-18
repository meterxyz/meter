/**
 * Multi-tier fallback streaming for Meter.
 *
 * Tier 1: OpenRouter (user's selected model)
 * Tier 2: Same model via direct API key (CLAUDE_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY) — silent
 * Tier 3: Auto-route to a different model via direct key — sends "rerouting" event to client
 *
 * If all tiers fail, sends a final error event.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { ToolDef } from "./tools";

/* ─── Types ─────────────────────────────────────────────────────── */

type Message = OpenAI.Chat.ChatCompletionMessageParam;

export type StreamEvent = Record<string, unknown>;
export type Send = (data: StreamEvent) => void;

/** Return true if the error is retryable (rate limit, capacity, server error) */
function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; code?: string; type?: string; message?: string };
  const status = e.status ?? 0;
  const msg = (e.message ?? "").toLowerCase();
  if (status === 429 || status === 503 || status >= 500) return true;
  if (e.code === "rate_limit_exceeded" || e.type === "rate_limit_error") return true;
  if (/rate.?limit|too many request|throttl|capacity|overloaded|unavailable/i.test(msg)) return true;
  return false;
}

/* ─── Provider mapping ──────────────────────────────────────────── */

/** Maps OpenRouter model prefixes to direct API env var + native model ID */
interface DirectProvider {
  envKey: string;
  /** The native model ID to use with the direct API */
  nativeModel: string;
  sdk: "anthropic" | "openai" | "gemini";
}

const DIRECT_PROVIDERS: Record<string, DirectProvider> = {
  "anthropic/claude-sonnet-4.6": { envKey: "CLAUDE_API_KEY", nativeModel: "claude-sonnet-4-6", sdk: "anthropic" },
  "anthropic/claude-opus-4.6": { envKey: "CLAUDE_API_KEY", nativeModel: "claude-opus-4-6", sdk: "anthropic" },
  "openai/gpt-5.2": { envKey: "OPENAI_API_KEY", nativeModel: "gpt-5.2", sdk: "openai" },
  "google/gemini-3-pro-preview": { envKey: "GEMINI_API_KEY", nativeModel: "gemini-3-pro-preview", sdk: "gemini" },
};

/**
 * Auto-route fallback order: when all tiers for the original model fail,
 * try these models in order (skipping the original).
 */
const AUTO_ROUTE_ORDER = [
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.2",
  "google/gemini-3-pro-preview",
];

/* ─── Streaming adapters ────────────────────────────────────────── */

/**
 * Stream via OpenRouter (Tier 1). Uses OpenAI SDK pointed at OpenRouter.
 * Yields delta events. Throws on error.
 */
export async function streamOpenRouter(
  model: string,
  conversation: Message[],
  tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
): Promise<{ textContent: string; toolCalls: Map<number, { id: string; name: string; arguments: string }>; hasToolCalls: boolean }> {
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const response = await client.chat.completions.create({
    model,
    messages: conversation,
    tools,
    stream: true,
    stream_options: { include_usage: true },
  });

  let textContent = "";
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let hasToolCalls = false;

  for await (const chunk of response) {
    const choice = chunk.choices?.[0];
    if (!choice) {
      if (chunk.usage) {
        send({ type: "usage", tokensIn: chunk.usage.prompt_tokens, tokensOut: chunk.usage.completion_tokens });
      }
      continue;
    }

    const delta = choice.delta?.content || "";
    if (delta) {
      textContent += delta;
      totalTokensOut.value += estimateTokens(delta);
      send({ type: "delta", content: delta, tokensOut: totalTokensOut.value });
    }

    if (choice.delta?.tool_calls) {
      hasToolCalls = true;
      for (const tc of choice.delta.tool_calls) {
        const existing = toolCalls.get(tc.index) || { id: "", name: "", arguments: "" };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
        toolCalls.set(tc.index, existing);
      }
    }

    if (chunk.usage) {
      send({ type: "usage", tokensIn: chunk.usage.prompt_tokens, tokensOut: chunk.usage.completion_tokens });
    }
  }

  return { textContent, toolCalls, hasToolCalls };
}

/**
 * Stream via direct Anthropic API (Tier 2). Uses @anthropic-ai/sdk.
 */
async function streamAnthropic(
  nativeModel: string,
  apiKey: string,
  conversation: Message[],
  tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
): Promise<{ textContent: string; toolCalls: Map<number, { id: string; name: string; arguments: string }>; hasToolCalls: boolean }> {
  const client = new Anthropic({ apiKey });

  // Convert OpenAI message format to Anthropic format
  const systemMsg = conversation.find((m) => m.role === "system");
  const systemText = typeof systemMsg?.content === "string" ? systemMsg.content : "";
  const msgs: Anthropic.MessageParam[] = conversation
    .filter((m) => m.role !== "system" && m.role !== "tool")
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    }));

  // Convert tool defs to Anthropic format
  const anthropicTools = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
  }));

  const stream = await client.messages.stream({
    model: nativeModel,
    max_tokens: 8192,
    system: systemText,
    messages: msgs,
    tools: anthropicTools,
  });

  let textContent = "";
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let hasToolCalls = false;
  let toolIdx = 0;

  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        const delta = event.delta.text;
        textContent += delta;
        totalTokensOut.value += estimateTokens(delta);
        send({ type: "delta", content: delta, tokensOut: totalTokensOut.value });
      } else if (event.delta.type === "input_json_delta") {
        const existing = toolCalls.get(toolIdx - 1);
        if (existing) existing.arguments += event.delta.partial_json;
      }
    } else if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        hasToolCalls = true;
        toolCalls.set(toolIdx, { id: event.content_block.id, name: event.content_block.name, arguments: "" });
        toolIdx++;
      }
    } else if (event.type === "message_delta" && event.usage) {
      send({ type: "usage", tokensIn: 0, tokensOut: event.usage.output_tokens });
    }
  }

  const finalMessage = await stream.finalMessage();
  if (finalMessage.usage) {
    send({ type: "usage", tokensIn: finalMessage.usage.input_tokens, tokensOut: finalMessage.usage.output_tokens });
  }

  return { textContent, toolCalls, hasToolCalls };
}

/**
 * Stream via direct OpenAI API (Tier 2). Uses openai SDK with default base URL.
 */
async function streamOpenAIDirect(
  nativeModel: string,
  apiKey: string,
  conversation: Message[],
  tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
): Promise<{ textContent: string; toolCalls: Map<number, { id: string; name: string; arguments: string }>; hasToolCalls: boolean }> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: nativeModel,
    messages: conversation,
    tools,
    stream: true,
    stream_options: { include_usage: true },
  });

  let textContent = "";
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let hasToolCalls = false;

  for await (const chunk of response) {
    const choice = chunk.choices?.[0];
    if (!choice) {
      if (chunk.usage) {
        send({ type: "usage", tokensIn: chunk.usage.prompt_tokens, tokensOut: chunk.usage.completion_tokens });
      }
      continue;
    }

    const delta = choice.delta?.content || "";
    if (delta) {
      textContent += delta;
      totalTokensOut.value += estimateTokens(delta);
      send({ type: "delta", content: delta, tokensOut: totalTokensOut.value });
    }

    if (choice.delta?.tool_calls) {
      hasToolCalls = true;
      for (const tc of choice.delta.tool_calls) {
        const existing = toolCalls.get(tc.index) || { id: "", name: "", arguments: "" };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
        toolCalls.set(tc.index, existing);
      }
    }

    if (chunk.usage) {
      send({ type: "usage", tokensIn: chunk.usage.prompt_tokens, tokensOut: chunk.usage.completion_tokens });
    }
  }

  return { textContent, toolCalls, hasToolCalls };
}

/**
 * Stream via Google Gemini API (Tier 2). Uses @google/generative-ai.
 * Note: Gemini doesn't support OpenAI-style tool calling in the same way,
 * so we stream text only for the fallback path.
 */
async function streamGemini(
  nativeModel: string,
  apiKey: string,
  conversation: Message[],
  _tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
): Promise<{ textContent: string; toolCalls: Map<number, { id: string; name: string; arguments: string }>; hasToolCalls: boolean }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: nativeModel });

  // Convert messages to Gemini format
  const systemMsg = conversation.find((m) => m.role === "system");
  const systemText = typeof systemMsg?.content === "string" ? systemMsg.content : "";

  const contents: Content[] = [];
  for (const m of conversation) {
    if (m.role === "system") continue;
    const text = typeof m.content === "string" ? m.content : "";
    if (!text) continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }

  const result = await model.generateContentStream({
    contents,
    systemInstruction: systemText ? { role: "user", parts: [{ text: systemText }] } : undefined,
  });

  let textContent = "";

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      textContent += text;
      totalTokensOut.value += estimateTokens(text);
      send({ type: "delta", content: text, tokensOut: totalTokensOut.value });
    }
  }

  const response = await result.response;
  if (response.usageMetadata) {
    send({
      type: "usage",
      tokensIn: response.usageMetadata.promptTokenCount,
      tokensOut: response.usageMetadata.candidatesTokenCount,
    });
  }

  // Gemini fallback doesn't do tool calls
  return { textContent, toolCalls: new Map(), hasToolCalls: false };
}

/* ─── Direct API dispatcher ─────────────────────────────────────── */

function streamDirect(
  provider: DirectProvider,
  apiKey: string,
  conversation: Message[],
  tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
) {
  switch (provider.sdk) {
    case "anthropic":
      return streamAnthropic(provider.nativeModel, apiKey, conversation, tools, send, estimateTokens, totalTokensOut);
    case "openai":
      return streamOpenAIDirect(provider.nativeModel, apiKey, conversation, tools, send, estimateTokens, totalTokensOut);
    case "gemini":
      return streamGemini(provider.nativeModel, apiKey, conversation, tools, send, estimateTokens, totalTokensOut);
  }
}

/* ─── Main fallback orchestrator ────────────────────────────────── */

export interface FallbackResult {
  textContent: string;
  toolCalls: Map<number, { id: string; name: string; arguments: string }>;
  hasToolCalls: boolean;
  /** Which model actually served the response */
  actualModel: string;
  /** Which tier succeeded: 1=openrouter, 2=direct-same-model, 3=auto-route */
  tier: number;
}

/**
 * Attempt to stream a response with multi-tier fallback.
 *
 * Tier 1: OpenRouter with the requested model
 * Tier 2: Same model via direct API key (silent — no client notification)
 * Tier 3: Different model via direct API key (sends "rerouting" event)
 *
 * Throws only if ALL tiers fail.
 */
export async function streamWithFallback(
  requestedModel: string,
  conversation: Message[],
  tools: ToolDef[],
  send: Send,
  estimateTokens: (text: string) => number,
  totalTokensOut: { value: number },
): Promise<FallbackResult> {
  const errors: { tier: number; model: string; error: string }[] = [];

  // ── Tier 1: OpenRouter ──────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const result = await streamOpenRouter(requestedModel, conversation, tools, send, estimateTokens, totalTokensOut);
      return { ...result, actualModel: requestedModel, tier: 1 };
    } catch (err) {
      const e = err as Error;
      console.error("[fallback] tier 1 (openrouter) failed:", requestedModel, e.message);
      errors.push({ tier: 1, model: requestedModel, error: e.message });

      if (!isRetryable(err)) {
        // Non-retryable (auth, bad request) — still try direct key for same model
      }
    }
  }

  // ── Tier 2: Same model via direct API key (silent) ──────────────
  const directProvider = DIRECT_PROVIDERS[requestedModel];
  const directKey = directProvider ? process.env[directProvider.envKey] : undefined;

  if (directProvider && directKey) {
    try {
      console.log("[fallback] tier 2 (direct key, same model):", requestedModel);
      const result = await streamDirect(directProvider, directKey, conversation, tools, send, estimateTokens, totalTokensOut);
      return { ...result, actualModel: requestedModel, tier: 2 };
    } catch (err) {
      const e = err as Error;
      console.error("[fallback] tier 2 (direct) failed:", requestedModel, e.message);
      errors.push({ tier: 2, model: requestedModel, error: e.message });
    }
  }

  // ── Tier 3: Auto-route to a different model ─────────────────────
  const candidates = AUTO_ROUTE_ORDER.filter((m) => m !== requestedModel);

  for (const candidateModel of candidates) {
    const candidateProvider = DIRECT_PROVIDERS[candidateModel];
    const candidateKey = candidateProvider ? process.env[candidateProvider.envKey] : undefined;
    if (!candidateProvider || !candidateKey) continue;

    try {
      console.log("[fallback] tier 3 (auto-route):", candidateModel);

      // Notify client about the reroute
      const providerName = requestedModel.split("/")[0];
      const providerLabel = providerName.charAt(0).toUpperCase() + providerName.slice(1);
      send({ type: "rerouting", from: requestedModel, to: candidateModel, provider: providerLabel });

      const result = await streamDirect(candidateProvider, candidateKey, conversation, tools, send, estimateTokens, totalTokensOut);
      return { ...result, actualModel: candidateModel, tier: 3 };
    } catch (err) {
      const e = err as Error;
      console.error("[fallback] tier 3 failed:", candidateModel, e.message);
      errors.push({ tier: 3, model: candidateModel, error: e.message });
      continue;
    }
  }

  // Also try OpenRouter for auto-route candidates as last resort
  if (process.env.OPENROUTER_API_KEY) {
    for (const candidateModel of candidates) {
      try {
        console.log("[fallback] tier 3 openrouter fallback:", candidateModel);

        const providerName = requestedModel.split("/")[0];
        const providerLabel = providerName.charAt(0).toUpperCase() + providerName.slice(1);
        send({ type: "rerouting", from: requestedModel, to: candidateModel, provider: providerLabel });

        const result = await streamOpenRouter(candidateModel, conversation, tools, send, estimateTokens, totalTokensOut);
        return { ...result, actualModel: candidateModel, tier: 3 };
      } catch (err) {
        const e = err as Error;
        console.error("[fallback] tier 3 openrouter fallback failed:", candidateModel, e.message);
        errors.push({ tier: 3, model: candidateModel, error: e.message });
        continue;
      }
    }
  }

  // All tiers exhausted
  console.error("[fallback] all tiers failed:", JSON.stringify(errors));
  throw new Error("All model providers failed");
}
