export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  color: string;
  inputPrice: number;  // per token
  outputPrice: number; // per token
}

export const MODELS: ModelConfig[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "Meter",
    color: "#A1A1AA",
    inputPrice: 3.0 / 1_000_000,
    outputPrice: 15.0 / 1_000_000,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Sonnet 4.6",
    provider: "Anthropic",
    color: "#D97757",
    inputPrice: 3.0 / 1_000_000,
    outputPrice: 15.0 / 1_000_000,
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Opus 4.6",
    provider: "Anthropic",
    color: "#D97757",
    inputPrice: 5.0 / 1_000_000,
    outputPrice: 25.0 / 1_000_000,
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "OpenAI",
    color: "#10A37F",
    inputPrice: 1.75 / 1_000_000,
    outputPrice: 14.0 / 1_000_000,
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    color: "#4285F4",
    inputPrice: 2.0 / 1_000_000,
    outputPrice: 12.0 / 1_000_000,
  },
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    color: "#4D6BFE",
    inputPrice: 0.27 / 1_000_000,
    outputPrice: 1.10 / 1_000_000,
  },
];

export const DEFAULT_MODEL = MODELS[0];

export function getModel(id: string): ModelConfig {
  return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}

export function shortModelName(id: string): string {
  return getModel(id).name;
}
