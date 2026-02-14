import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  timestamp: number;
  settlementId?: string; // links to a Settlement
}

export interface Settlement {
  id: string;
  txHash: string;
  sessionId: string;
  amount: number;
  tokensIn: number;
  tokensOut: number;
  timestamp: number;
  status: "pending" | "settled" | "failed";
}

export interface MeterEvent {
  id: string;
  type: "tick" | "settlement_success" | "settlement_fail" | "cap_hit" | "revoke";
  message: string;
  timestamp: number;
}

// Pricing: GPT-4o — $2.50/1M input, $10/1M output
const INPUT_PRICE_PER_TOKEN = 2.5 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 10 / 1_000_000;

interface MeterState {
  // Session
  sessionId: string;
  sessionStart: number;

  // Session key (ephemeral signer)
  sessionKeyPrivate: string | null;  // hex private key
  sessionKeyAddress: string | null;  // derived address
  authorized: boolean;               // user has approved

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;

  // Metering
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  maxSpend: number;
  burnRate: number; // $/sec rolling average

  // Settlements
  settlements: Settlement[];

  // Event log
  events: MeterEvent[];

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: string;

  // Actions
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, tokensOut: number) => void;
  finalizeResponse: (tokensIn: number, tokensOut: number) => void;
  setStreaming: (v: boolean) => void;
  toggleInspector: () => void;
  setInspectorOpen: (v: boolean) => void;
  setInspectorTab: (tab: string) => void;
  addSettlement: (s: Settlement) => void;
  updateSettlement: (id: string, updates: Partial<Settlement>) => void;
  addEvent: (type: MeterEvent["type"], message: string) => void;
  setMaxSpend: (v: number) => void;
  linkSettlementToMessage: (messageId: string, settlementId: string) => void;
  setSessionKey: (privateKey: string, address: string) => void;
  setAuthorized: (v: boolean) => void;
  revoke: () => void;
  reset: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function generateSessionId() {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useMeterStore = create<MeterState>((set, get) => ({
  sessionId: generateSessionId(),
  sessionStart: Date.now(),

  sessionKeyPrivate: null,
  sessionKeyAddress: null,
  authorized: false,

  messages: [],
  isStreaming: false,

  totalTokensIn: 0,
  totalTokensOut: 0,
  totalCost: 0,
  maxSpend: 1.0, // $1 default cap
  burnRate: 0,

  settlements: [],
  events: [],
  inspectorOpen: false,
  inspectorTab: "wallet",

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistantMessage: (content, tokensOut) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content, tokensOut };
      }
      const newTotalOut = s.totalTokensOut + (tokensOut - (last?.tokensOut || 0));
      const costDelta = (tokensOut - (last?.tokensOut || 0)) * OUTPUT_PRICE_PER_TOKEN;
      const elapsed = (Date.now() - s.sessionStart) / 1000;
      return {
        messages: msgs,
        totalTokensOut: newTotalOut,
        totalCost: s.totalCost + costDelta,
        burnRate: elapsed > 0 ? (s.totalCost + costDelta) / elapsed : 0,
      };
    }),

  finalizeResponse: (tokensIn, tokensOut) =>
    set((s) => {
      const inputCost = tokensIn * INPUT_PRICE_PER_TOKEN;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        const totalMsgCost = inputCost + tokensOut * OUTPUT_PRICE_PER_TOKEN;
        msgs[msgs.length - 1] = { ...last, tokensIn, tokensOut, cost: totalMsgCost };
      }
      return {
        messages: msgs,
        totalTokensIn: s.totalTokensIn + tokensIn,
      };
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (v) => set({ inspectorOpen: v }),

  addSettlement: (s) =>
    set((state) => ({ settlements: [s, ...state.settlements] })),

  updateSettlement: (id, updates) =>
    set((state) => ({
      settlements: state.settlements.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  addEvent: (type, message) =>
    set((s) => ({
      events: [
        { id: generateId(), type, message, timestamp: Date.now() },
        ...s.events,
      ],
    })),

  setMaxSpend: (v) => set({ maxSpend: v }),

  linkSettlementToMessage: (messageId, settlementId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, settlementId } : m
      ),
    })),

  setSessionKey: (privateKey, address) =>
    set({ sessionKeyPrivate: privateKey, sessionKeyAddress: address }),

  setAuthorized: (v) => set({ authorized: v }),

  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  revoke: () =>
    set({
      sessionKeyPrivate: null,
      sessionKeyAddress: null,
      authorized: false,
      messages: [],
      isStreaming: false,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      burnRate: 0,
      settlements: [],
      events: [],
    }),

  reset: () =>
    set({
      sessionId: generateSessionId(),
      sessionStart: Date.now(),
      sessionKeyPrivate: null,
      sessionKeyAddress: null,
      authorized: false,
      messages: [],
      isStreaming: false,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      burnRate: 0,
      settlements: [],
      events: [],
    }),
}));
