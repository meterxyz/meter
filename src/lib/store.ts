import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_MODEL, getModel } from "@/lib/models";

export type ReceiptStatus = "signing" | "signed" | "settled";

export interface ActionCard {
  id: string;
  type: "domain" | "service" | "action";
  title: string;
  description: string;
  cost?: number;
  status: "pending" | "approved" | "rejected";
  metadata?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  confidence?: number;
  settled?: boolean;
  receiptStatus?: ReceiptStatus;
  signature?: string;
  txHash?: string;
  timestamp: number;
  cards?: ActionCard[];
  decisionId?: string;
}

export interface PaymentCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface SettlementRecord {
  id: string;
  amount: number;
  workspaceId?: string;
  stripePaymentIntentId?: string;
  txHash?: string;
  messageCount: number;
  chargeCount: number;
  cardLast4?: string;
  cardBrand?: string;
  status: string;
  createdAt: string;
}

export interface SpendLimits {
  dailyLimit: number | null;
  monthlyLimit: number | null;
  perTxnLimit: number | null;
}

interface ProjectThread {
  id: string;
  name: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  settlementError: string | null;
  chatBlocked: boolean;
  todayCost: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayMessageCount: number;
  todayByModel: Record<string, { cost: number; count: number }>;
  todayDate: string;
  totalCost: number;
}

interface MeterState {
  userId: string | null;
  email: string | null;
  authenticated: boolean;
  cardOnFile: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  stripeCustomerId: string | null;
  connectedServices: Record<string, boolean>;
  connectionsLoading: boolean;

  selectedModelId: string;
  spendingCapEnabled: boolean;
  spendingCap: number;

  projects: ProjectThread[];
  activeProjectId: string;

  pendingCharges: {
    id: string;
    title: string;
    cost: number;
    type: "usage" | "card";
    workspaceId: string;
    paidAt?: number;
  }[];
  autoSettleThreshold: number;
  isSettling: boolean;

  pendingInput: string | null;

  cards: PaymentCard[];
  cardsLoading: boolean;
  settlementHistory: SettlementRecord[];
  settlementHistoryLoading: boolean;
  spendLimits: SpendLimits;

  decisionMode: boolean;

  inspectorOpen: boolean;
  inspectorTab: string;

  setAuth: (userId: string, email: string) => void;
  setCardOnFile: (v: boolean, last4?: string, brand?: string) => void;
  setStripeCustomerId: (id: string) => void;
  connectService: (id: string) => void;
  disconnectService: (id: string) => void;
  fetchConnectionStatus: () => Promise<void>;
  disconnectServiceRemote: (id: string) => Promise<void>;
  submitApiKey: (provider: string, apiKey: string, metadata?: Record<string, unknown>) => Promise<boolean>;
  logout: () => void;

  addProject: (name: string, id?: string) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string) => void;

  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string, tokensOut: number) => void;
  finalizeResponse: (tokensIn: number, tokensOut: number, confidence: number, actualModel?: string) => void;
  setStreaming: (v: boolean) => void;
  markSettled: (messageId: string) => void;
  settleAll: () => Promise<{ success: boolean; error?: string }>;
  getPendingBalance: () => number;
  getUnsettledMessages: () => ChatMessage[];
  clearSettlementError: () => void;

  approveCard: (messageId: string, cardId: string) => void;
  rejectCard: (messageId: string, cardId: string) => void;
  setMessageDecisionId: (decisionId: string) => void;

  setPendingInput: (v: string | null) => void;

  toggleInspector: () => void;
  setInspectorOpen: (v: boolean) => void;
  setInspectorTab: (tab: string) => void;

  setSelectedModelId: (id: string) => void;
  setSpendingCapEnabled: (v: boolean) => void;
  setSpendingCap: (v: number) => void;
  setAutoSettleThreshold: (v: number) => void;
  setIsSettling: (v: boolean) => void;
  setDecisionMode: (v: boolean) => void;

  fetchCards: () => Promise<void>;
  setDefaultCard: (paymentMethodId: string) => Promise<void>;
  removeCard: (paymentMethodId: string) => Promise<{ success: boolean; error?: string }>;

  fetchSettlementHistory: (workspaceId?: string) => Promise<void>;

  fetchSpendLimits: (workspaceId?: string) => Promise<void>;
  updateSpendLimits: (limits: Partial<SpendLimits>, workspaceId?: string) => Promise<void>;

  resetDailyIfNeeded: () => void;

  reset: () => void;
}

function todayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function createProject(id: string, name: string): ProjectThread {
  return {
    id,
    name,
    messages: [],
    isStreaming: false,
    settlementError: null,
    chatBlocked: false,
    todayCost: 0,
    todayTokensIn: 0,
    todayTokensOut: 0,
    todayMessageCount: 0,
    todayByModel: {},
    todayDate: todayStr(),
    totalCost: 0,
  };
}

function ensureDaily(project: ProjectThread): ProjectThread {
  const today = todayStr();
  if (project.todayDate === today) return project;
  return {
    ...project,
    todayCost: 0,
    todayTokensIn: 0,
    todayTokensOut: 0,
    todayMessageCount: 0,
    todayByModel: {},
    todayDate: today,
  };
}

function getActiveProject(state: MeterState): ProjectThread {
  return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
}

function replaceActiveProject(state: MeterState, project: ProjectThread): ProjectThread[] {
  return state.projects.map((p) => (p.id === project.id ? project : p));
}

function shortHex() {
  return Math.random().toString(16).slice(2, 10);
}

const initialProjects = [
  createProject("meter", "Meter"),
  createProject("keypass", "Keypass"),
];

export const useMeterStore = create<MeterState>()(
  persist(
    (set, get) => ({
      userId: null,
      email: null,
      authenticated: false,
      cardOnFile: false,
      cardLast4: null,
      cardBrand: null,
      stripeCustomerId: null,
      connectedServices: {},
      connectionsLoading: false,

      selectedModelId: DEFAULT_MODEL.id,
      spendingCapEnabled: false,
      spendingCap: 10,

      projects: initialProjects,
      activeProjectId: "meter",

      pendingCharges: [],
      autoSettleThreshold: 10,
      isSettling: false,

      cards: [],
      cardsLoading: false,
      settlementHistory: [],
      settlementHistoryLoading: false,
      spendLimits: { dailyLimit: null, monthlyLimit: null, perTxnLimit: null },

      pendingInput: null,

      decisionMode: false,

      inspectorOpen: false,
      inspectorTab: "decisions",

      setAuth: (userId, email) => set({ userId, email, authenticated: true }),
      setCardOnFile: (v, last4, brand) => set({ cardOnFile: v, cardLast4: last4 ?? null, cardBrand: brand ?? null }),
      setStripeCustomerId: (id) => set({ stripeCustomerId: id }),
      connectService: (id) =>
        set((s) => ({ connectedServices: { ...s.connectedServices, [id]: true } })),
      disconnectService: (id) =>
        set((s) => ({ connectedServices: { ...s.connectedServices, [id]: false } })),

      fetchConnectionStatus: async () => {
        const userId = get().userId;
        if (!userId) return;
        set({ connectionsLoading: true });
        try {
          const res = await fetch(`/api/oauth/status?userId=${encodeURIComponent(userId)}`);
          if (res.ok) {
            const status = await res.json();
            set({ connectedServices: status });
          }
        } catch {
          // Silently fail — local state remains
        } finally {
          set({ connectionsLoading: false });
        }
      },

      disconnectServiceRemote: async (id) => {
        const userId = get().userId;
        if (!userId) return;
        set((s) => ({ connectedServices: { ...s.connectedServices, [id]: false } }));
        try {
          await fetch(`/api/oauth/${id}/disconnect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
        } catch {
          // Silently fail
        }
      },

      submitApiKey: async (provider, apiKey, metadata) => {
        const userId = get().userId;
        if (!userId) return false;
        try {
          const res = await fetch("/api/oauth/api-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, provider, apiKey, metadata: metadata ?? null }),
          });
          if (res.ok) {
            set((s) => ({ connectedServices: { ...s.connectedServices, [provider]: true } }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      logout: () =>
        set({
          userId: null,
          email: null,
          authenticated: false,
          cardOnFile: false,
          cardLast4: null,
          cardBrand: null,
          stripeCustomerId: null,
          connectedServices: {},
          projects: initialProjects,
          activeProjectId: "meter",
          inspectorOpen: false,
          pendingCharges: [],
          isSettling: false,
        }),

      addProject: (name, idOverride) =>
        set((s) => {
          const cleanName = name.trim();
          if (!cleanName) return s;
          const id = idOverride ?? cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (s.projects.some((p) => p.id === id)) return s;
          return { projects: [...s.projects, createProject(id, cleanName)] };
        }),

      removeProject: (id) =>
        set((s) => {
          const remaining = s.projects.filter((p) => p.id !== id);
          const nextActiveId =
            s.activeProjectId === id
              ? remaining[0]?.id ?? "meter"
              : s.activeProjectId;
          return { projects: remaining, activeProjectId: nextActiveId };
        }),

      setActiveProject: (id) =>
        set((s) => {
          if (!s.projects.some((p) => p.id === id)) return s;
          const projects = s.projects.map((p) => (p.id === id ? ensureDaily(p) : p));
          return { projects, activeProjectId: id };
        }),

      addMessage: (msg) =>
        set((s) => {
          const active = ensureDaily(getActiveProject(s));
          const updated = { ...active, messages: [...active.messages, msg] };
          return { projects: replaceActiveProject(s, updated) };
        }),

      updateLastAssistantMessage: (content, tokensOut) =>
        set((s) => {
          const active = ensureDaily(getActiveProject(s));
          const pricingModelId = s.selectedModelId === "auto" ? "anthropic/claude-sonnet-4.6" : s.selectedModelId;
          const model = getModel(pricingModelId);
          const msgs = [...active.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content, tokensOut, receiptStatus: "signing" };
          }

          const prevOut = last?.tokensOut || 0;
          const deltaOut = Math.max(0, tokensOut - prevOut);
          const costDelta = deltaOut * model.outputPrice;

          const updated = {
            ...active,
            messages: msgs,
            todayTokensOut: active.todayTokensOut + deltaOut,
            todayCost: active.todayCost + costDelta,
            totalCost: active.totalCost + costDelta,
          };

          return { projects: replaceActiveProject(s, updated) };
        }),

      finalizeResponse: (tokensIn, tokensOut, confidence, actualModel) => {
        const balanceBefore = get().getPendingBalance();

        set((s) => {
          const active = ensureDaily(getActiveProject(s));
          const pricingModelId = actualModel
            ?? (s.selectedModelId === "auto" ? "anthropic/claude-sonnet-4.6" : s.selectedModelId);
          const model = getModel(pricingModelId);
          const inputCost = tokensIn * model.inputPrice;
          const totalMsgCost = inputCost + tokensOut * model.outputPrice;

          const msgs = [...active.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...last,
              tokensIn,
              tokensOut,
              cost: totalMsgCost,
              confidence,
              model: pricingModelId,
              settled: false,
              receiptStatus: "signed",
              signature: `0x${shortHex()}${shortHex()}${shortHex()}`,
            };
          }

          const byModel = { ...active.todayByModel };
          const modelKey = model.name;
          const existing = byModel[modelKey] || { cost: 0, count: 0 };
          byModel[modelKey] = {
            cost: existing.cost + totalMsgCost,
            count: existing.count + 1,
          };

          // Output costs are incrementally added during streaming by
          // updateLastAssistantMessage using the *selected* model's price.
          // When the actual model differs (rerouting), reconcile against what
          // was accumulated, not the final model's rate.
          const selectedPricingId = s.selectedModelId === "auto" ? "anthropic/claude-sonnet-4.6" : s.selectedModelId;
          const streamingModel = getModel(selectedPricingId);
          const streamedOutputCost = (last?.tokensOut ?? 0) * streamingModel.outputPrice;
          const finalOutputCost = tokensOut * model.outputPrice;
          const costDelta = inputCost + (finalOutputCost - streamedOutputCost);

          const updated = {
            ...active,
            messages: msgs,
            todayTokensIn: active.todayTokensIn + tokensIn,
            todayMessageCount: active.todayMessageCount + 1,
            todayByModel: byModel,
            todayCost: active.todayCost + costDelta,
            totalCost: active.totalCost + costDelta,
          };

          return { projects: replaceActiveProject(s, updated) };
        });

        const afterState = get();
        const threshold = afterState.autoSettleThreshold;
        if (balanceBefore < threshold && afterState.getPendingBalance() >= threshold) {
          afterState.settleAll();
        }
      },

      markSettled: (messageId) =>
        set((s) => {
          const active = getActiveProject(s);
          const updated = {
            ...active,
            messages: active.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    settled: true,
                    receiptStatus: "settled" as const,
                    txHash: `0x${shortHex()}${shortHex()}${shortHex()}${shortHex()}`,
                  }
                : m
            ),
          };
          return { projects: replaceActiveProject(s, updated) };
        }),

      getPendingBalance: () => {
        const s = get();
        const active = getActiveProject(s);
        if (!active) return 0;
        const msgCost = active.messages
          .filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled)
          .reduce((sum, m) => sum + (m.cost ?? 0), 0);
        const cardCost = s.pendingCharges
          .filter((c) => c.workspaceId === active.id)
          .reduce((sum, c) => sum + c.cost, 0);
        return msgCost + cardCost;
      },

      getUnsettledMessages: () => {
        const s = get();
        const active = getActiveProject(s);
        if (!active) return [];
        return active.messages
          .filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled);
      },

      settleAll: async () => {
        const s = get();
        if (s.isSettling) return { success: false, error: "Already settling" };
        set((prev) => {
          const active = getActiveProject(prev);
          if (!active) return { isSettling: true };
          return {
            isSettling: true,
            projects: replaceActiveProject(prev, { ...active, settlementError: null }),
          };
        });

        const active = getActiveProject(s);
        if (!active) {
          set({ isSettling: false });
          return { success: false, error: "No active workspace" };
        }

        const unsettledMsgs = active.messages
          .filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled);
        const messageIds = unsettledMsgs.map((m) => m.id);
        const chargeIds = s.pendingCharges
          .filter((c) => c.workspaceId === active.id)
          .map((c) => c.id);
        const amount = s.getPendingBalance();

        if (amount <= 0) {
          set({ isSettling: false });
          return { success: false, error: "No balance to settle" };
        }

        try {
          const res = await fetch("/api/billing/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: s.userId,
              stripeCustomerId: s.stripeCustomerId,
              workspaceId: active.id,
              amount,
              messageIds,
              chargeIds,
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: "Settlement failed" }));
            const errorMsg = body.error ?? "Settlement failed";
            set((prev) => {
              const current = getActiveProject(prev);
              if (!current) return { isSettling: false };
              return {
                isSettling: false,
                projects: replaceActiveProject(prev, {
                  ...current,
                  settlementError: errorMsg,
                  chatBlocked: true,
                }),
              };
            });
            return { success: false, error: errorMsg };
          }

          const data = await res.json();
          const batchTxHash = data.txHash as string | undefined;

          set((prev) => {
            const current = getActiveProject(prev);
            if (!current) return { isSettling: false };
            const updatedProject = {
              ...current,
              messages: current.messages.map((m) =>
                messageIds.includes(m.id)
                  ? {
                      ...m,
                      settled: true,
                      receiptStatus: "settled" as const,
                      txHash: batchTxHash ?? `0x${shortHex()}${shortHex()}${shortHex()}${shortHex()}`,
                    }
                  : m
              ),
              settlementError: null,
              chatBlocked: false,
            };
            const remainingCharges = prev.pendingCharges.filter((c) => c.workspaceId !== current.id);
            return {
              projects: replaceActiveProject(prev, updatedProject),
              pendingCharges: remainingCharges,
              isSettling: false,
            };
          });
          return { success: true };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Settlement failed";
          set((prev) => {
            const current = getActiveProject(prev);
            if (!current) return { isSettling: false };
            return {
              isSettling: false,
              projects: replaceActiveProject(prev, {
                ...current,
                settlementError: errorMsg,
                chatBlocked: true,
              }),
            };
          });
          return { success: false, error: errorMsg };
        }
      },

      approveCard: (messageId, cardId) => {
        const balanceBefore = get().getPendingBalance();

        set((s) => {
          const active = getActiveProject(s);
          if (!active) return s;
          const updated = {
            ...active,
            messages: active.messages.map((m) => {
              if (m.id !== messageId) return m;
              const cards = m.cards?.map((c) =>
                c.id === cardId ? { ...c, status: "approved" as const } : c
              );
              return { ...m, cards };
            }),
          };
          const card = active.messages.find((m) => m.id === messageId)?.cards?.find((c) => c.id === cardId);
          const newCharge =
            card && card.cost
              ? [...s.pendingCharges, { id: card.id, title: card.title, cost: card.cost, type: "card" as const, workspaceId: active.id, paidAt: Date.now() }]
              : s.pendingCharges;
          return { projects: replaceActiveProject(s, updated), pendingCharges: newCharge };
        });

        const afterState = get();
        const threshold = afterState.autoSettleThreshold;
        if (balanceBefore < threshold && afterState.getPendingBalance() >= threshold) {
          afterState.settleAll();
        }
      },

      rejectCard: (messageId, cardId) =>
        set((s) => {
          const active = getActiveProject(s);
          const updated = {
            ...active,
            messages: active.messages.map((m) => {
              if (m.id !== messageId) return m;
              const cards = m.cards?.map((c) =>
                c.id === cardId ? { ...c, status: "rejected" as const } : c
              );
              return { ...m, cards };
            }),
          };
          return { projects: replaceActiveProject(s, updated) };
        }),

      setMessageDecisionId: (decisionId) =>
        set((s) => {
          const active = getActiveProject(s);
          const msgs = [...active.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, decisionId };
          }
          return { projects: replaceActiveProject(s, { ...active, messages: msgs }) };
        }),

      setStreaming: (v) =>
        set((s) => {
          const active = getActiveProject(s);
          const updated = { ...active, isStreaming: v };
          return { projects: replaceActiveProject(s, updated) };
        }),

      clearSettlementError: () =>
        set((s) => {
          const active = getActiveProject(s);
          if (!active) return s;
          return {
            projects: replaceActiveProject(s, { ...active, settlementError: null }),
          };
        }),

      fetchCards: async () => {
        const userId = get().userId;
        if (!userId) return;
        set({ cardsLoading: true });
        try {
          const res = await fetch(`/api/billing/cards?userId=${encodeURIComponent(userId)}`);
          if (res.ok) {
            const data = await res.json();
            set({ cards: data.cards ?? [] });
          }
        } catch { /* silent */ } finally {
          set({ cardsLoading: false });
        }
      },

      setDefaultCard: async (paymentMethodId) => {
        const userId = get().userId;
        if (!userId) return;
        try {
          const res = await fetch("/api/billing/cards/default", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, paymentMethodId }),
          });
          if (res.ok) {
            const data = await res.json();
            set((s) => ({
              cards: s.cards.map((c) => ({ ...c, isDefault: c.id === paymentMethodId })),
              cardLast4: data.cardLast4,
              cardBrand: data.cardBrand,
            }));
          }
        } catch { /* silent */ }
      },

      removeCard: async (paymentMethodId) => {
        const userId = get().userId;
        if (!userId) return { success: false, error: "Not authenticated" };
        try {
          const res = await fetch(`/api/billing/cards/${paymentMethodId}?userId=${encodeURIComponent(userId)}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: "Failed to remove card" }));
            return { success: false, error: body.error };
          }
          set((s) => ({ cards: s.cards.filter((c) => c.id !== paymentMethodId) }));
          await get().fetchCards();
          return { success: true };
        } catch {
          return { success: false, error: "Failed to remove card" };
        }
      },

      fetchSettlementHistory: async (workspaceId) => {
        const userId = get().userId;
        const projectId = workspaceId ?? get().activeProjectId;
        if (!userId || !projectId) return;
        set({ settlementHistoryLoading: true });
        try {
          const res = await fetch(`/api/billing/history?userId=${encodeURIComponent(userId)}&workspaceId=${encodeURIComponent(projectId)}`);
          if (res.ok) {
            const data = await res.json();
            set({ settlementHistory: data.history ?? [] });
          }
        } catch { /* silent */ } finally {
          set({ settlementHistoryLoading: false });
        }
      },

      fetchSpendLimits: async (workspaceId) => {
        const userId = get().userId;
        const projectId = workspaceId ?? get().activeProjectId;
        if (!userId || !projectId) return;
        try {
          const res = await fetch(`/api/billing/spend-limits?userId=${encodeURIComponent(userId)}&workspaceId=${encodeURIComponent(projectId)}`);
          if (res.ok) {
            const data = await res.json();
            set({ spendLimits: { dailyLimit: data.dailyLimit ?? null, monthlyLimit: data.monthlyLimit ?? null, perTxnLimit: data.perTxnLimit ?? null } });
          }
        } catch { /* silent */ }
      },

      updateSpendLimits: async (limits, workspaceId) => {
        const userId = get().userId;
        const projectId = workspaceId ?? get().activeProjectId;
        if (!userId || !projectId) return;
        const merged = { ...get().spendLimits, ...limits };
        set({ spendLimits: merged });
        try {
          await fetch("/api/billing/spend-limits", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, workspaceId: projectId, ...merged }),
          });
        } catch { /* silent */ }
      },

      resetDailyIfNeeded: () =>
        set((s) => {
          let changed = false;
          const projects = s.projects.map((p) => {
            const next = ensureDaily(p);
            if (next !== p) changed = true;
            return next;
          });
          return changed ? { projects } : {};
        }),

      setPendingInput: (v) => set({ pendingInput: v }),

      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setInspectorOpen: (v) => set({ inspectorOpen: v }),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),
      setSelectedModelId: (id) => set({ selectedModelId: id }),
      setSpendingCapEnabled: (v) => set({ spendingCapEnabled: v }),
      setSpendingCap: (v) => set({ spendingCap: v }),
      setAutoSettleThreshold: (v) => set({ autoSettleThreshold: v }),
      setIsSettling: (v) => set({ isSettling: v }),
      setDecisionMode: (v) => set({ decisionMode: v }),

      reset: () =>
        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p,
            messages: [],
            isStreaming: false,
            settlementError: null,
            chatBlocked: false,
          })),
          pendingCharges: [],
          isSettling: false,
        })),
    }),
    {
      name: "meter-store-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        userId: s.userId,
        email: s.email,
        authenticated: s.authenticated,
        cardOnFile: s.cardOnFile,
        cardLast4: s.cardLast4,
        cardBrand: s.cardBrand,
        stripeCustomerId: s.stripeCustomerId,
        connectedServices: s.connectedServices,
        selectedModelId: s.selectedModelId,
        spendingCapEnabled: s.spendingCapEnabled,
        spendingCap: s.spendingCap,
        autoSettleThreshold: s.autoSettleThreshold,
        projects: s.projects,
        activeProjectId: s.activeProjectId,
      }),
    }
  )
);
