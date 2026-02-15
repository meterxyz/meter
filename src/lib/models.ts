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
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus",
    provider: "Anthropic",
    color: "#D97757",
    inputPrice: 5.5 / 1_000_000,
    outputPrice: 27.5 / 1_000_000,
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "OpenAI",
    color: "#10A37F",
    inputPrice: 1.925 / 1_000_000,
    outputPrice: 15.4 / 1_000_000,
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    color: "#4285F4",
    inputPrice: 2.2 / 1_000_000,
    outputPrice: 13.2 / 1_000_000,
  },
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    color: "#4D6BFE",
    inputPrice: 0.33 / 1_000_000,
    outputPrice: 0.968 / 1_000_000,
  },
  {
    id: "moonshotai/kimi-k2",
    name: "Kimi K2",
    provider: "Moonshot",
    color: "#6C5CE7",
    inputPrice: 0.66 / 1_000_000,
    outputPrice: 2.64 / 1_000_000,
  },
];

export const DEFAULT_MODEL = MODELS[0];

export function getModel(id: string): ModelConfig {
  return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}
