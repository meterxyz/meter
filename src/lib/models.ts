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
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet",
    provider: "Anthropic",
    color: "#D97757",
    inputPrice: 3 / 1_000_000,
    outputPrice: 15 / 1_000_000,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    color: "#10A37F",
    inputPrice: 2.5 / 1_000_000,
    outputPrice: 10 / 1_000_000,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini Flash",
    provider: "Google",
    color: "#4285F4",
    inputPrice: 0.30 / 1_000_000,
    outputPrice: 2.50 / 1_000_000,
  },
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    color: "#4D6BFE",
    inputPrice: 0.30 / 1_000_000,
    outputPrice: 0.88 / 1_000_000,
  },
  {
    id: "moonshotai/kimi-k2",
    name: "Kimi K2",
    provider: "Moonshot",
    color: "#6C5CE7",
    inputPrice: 0.60 / 1_000_000,
    outputPrice: 2.40 / 1_000_000,
  },
];

export const DEFAULT_MODEL = MODELS[0];

export function getModel(id: string): ModelConfig {
  return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}
