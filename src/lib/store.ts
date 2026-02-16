import { create } from "zustand";
import { DEFAULT_MODEL, getModel } from "@/lib/models";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;        // model ID used for this response
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;         // $ cost for this message
  confidence?: number;   // AI self-reported confidence 0-100
  settled?: boolean;     // billing accounted for
  timestamp: number;
}

interface MeterState {
  // Auth
  userId: string | null;
  email: string | null;
  authenticated: boolean;
  cardOnFile: boolean;

  // Model
  selectedModelId: string;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;

  // Daily metering (resets at midnight)
  todayCost: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayMessageCount: number;
  todayByModel: Record<string, { cost: number; count: number }>;
  todayDate: string;

  // Spending cap
  spendingCap: number;

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: string;

  // Actions
  setAuth: (userId: string, email: string) => void;
  setCardOnFile: (v: boolean) => void;
  logout: () => void;

  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, tokensOut: number) => void;
  finalizeResponse: (tokensIn: number, tokensOut: number, confidence: number) => void;
  setStreaming: (v: boolean) => void;
  markSettled: (messageId: string) => void;

  toggleInspector: () => void;
  setInspectorOpen: (v: boolean) => void;
  setInspectorTab: (tab: string) => void;

  setSelectedModelId: (id: string) => void;
  setSpendingCap: (v: number) => void;

  reset: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function maybeResetDaily(state: MeterState) {
  const today = todayStr();
  if (state.todayDate !== today) {
    return {
      todayCost: 0,
      todayTokensIn: 0,
      todayTokensOut: 0,
      todayMessageCount: 0,
      todayByModel: {} as Record<string, { cost: number; count: number }>,
      todayDate: today,
    };
  }
  return {};
}

export const useMeterStore = create<MeterState>((set) => ({
  userId: null,
  email: null,
  authenticated: false,
  cardOnFile: false,

  selectedModelId: DEFAULT_MODEL.id,

  messages: [],
  isStreaming: false,

  todayCost: 0,
  todayTokensIn: 0,
  todayTokensOut: 0,
  todayMessageCount: 0,
  todayByModel: {},
  todayDate: todayStr(),

  spendingCap: 10.0,

  inspectorOpen: false,
  inspectorTab: "usage",

  setAuth: (userId, email) =>
    set({ userId, email, authenticated: true }),

  setCardOnFile: (v) => set({ cardOnFile: v }),

  logout: () =>
    set({
      userId: null,
      email: null,
      authenticated: false,
      cardOnFile: false,
      messages: [],
      isStreaming: false,
      todayCost: 0,
      todayTokensIn: 0,
      todayTokensOut: 0,
      todayMessageCount: 0,
      todayByModel: {},
      inspectorOpen: false,
    }),

  addMessage: (msg) =>
    set((s) => {
      const resets = maybeResetDaily(s);
      return { ...resets, messages: [...s.messages, msg] };
    }),

  updateLastAssistantMessage: (content, tokensOut) =>
    set((s) => {
      const model = getModel(s.selectedModelId);
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content, tokensOut };
      }
      const prevOut = last?.tokensOut || 0;
      const deltaOut = tokensOut - prevOut;
      const costDelta = deltaOut * model.outputPrice;
      return {
        messages: msgs,
        todayTokensOut: s.todayTokensOut + deltaOut,
        todayCost: s.todayCost + costDelta,
      };
    }),

  finalizeResponse: (tokensIn, tokensOut, confidence) =>
    set((s) => {
      const model = getModel(s.selectedModelId);
      const inputCost = tokensIn * model.inputPrice;
      const totalMsgCost = inputCost + tokensOut * model.outputPrice;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = {
          ...last,
          tokensIn,
          tokensOut,
          cost: totalMsgCost,
          confidence,
          model: s.selectedModelId,
          settled: false,
        };
      }

      const byModel = { ...s.todayByModel };
      const modelKey = model.name;
      const existing = byModel[modelKey] || { cost: 0, count: 0 };
      byModel[modelKey] = {
        cost: existing.cost + totalMsgCost,
        count: existing.count + 1,
      };

      return {
        messages: msgs,
        todayTokensIn: s.todayTokensIn + tokensIn,
        todayMessageCount: s.todayMessageCount + 1,
        todayByModel: byModel,
      };
    }),

  markSettled: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, settled: true } : m
      ),
    })),

  setStreaming: (v) => set({ isStreaming: v }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (v) => set({ inspectorOpen: v }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setSpendingCap: (v) => set({ spendingCap: v }),

  reset: () =>
    set({
      messages: [],
      isStreaming: false,
      todayCost: 0,
      todayTokensIn: 0,
      todayTokensOut: 0,
      todayMessageCount: 0,
      todayByModel: {},
      todayDate: todayStr(),
    }),
}));
