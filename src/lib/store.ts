import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_MODEL, getModel } from "@/lib/models";

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
  timestamp: number;
}

interface ProjectThread {
  id: string;
  name: string;
  messages: ChatMessage[];
  isStreaming: boolean;
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

  selectedModelId: string;
  spendingCap: number;

  projects: ProjectThread[];
  activeProjectId: string;
  globalSpend: number;

  inspectorOpen: boolean;
  inspectorTab: string;

  setAuth: (userId: string, email: string) => void;
  setCardOnFile: (v: boolean) => void;
  logout: () => void;

  addProject: (name: string) => void;
  setActiveProject: (id: string) => void;

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

function createProject(id: string, name: string): ProjectThread {
  return {
    id,
    name,
    messages: [],
    isStreaming: false,
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

const initialProjects = [
  createProject("meter", "Meter"),
  createProject("keypass", "Keypass"),
];

export const useMeterStore = create<MeterState>()(
  persist(
    (set) => ({
      userId: null,
      email: null,
      authenticated: false,
      cardOnFile: false,

      selectedModelId: DEFAULT_MODEL.id,
      spendingCap: 10,

      projects: initialProjects,
      activeProjectId: "meter",
      globalSpend: 0,

      inspectorOpen: false,
      inspectorTab: "usage",

      setAuth: (userId, email) => set({ userId, email, authenticated: true }),
      setCardOnFile: (v) => set({ cardOnFile: v }),

      logout: () =>
        set({
          userId: null,
          email: null,
          authenticated: false,
          cardOnFile: false,
          projects: initialProjects,
          activeProjectId: "meter",
          globalSpend: 0,
          inspectorOpen: false,
        }),

      addProject: (name) =>
        set((s) => {
          const cleanName = name.trim();
          if (!cleanName) return s;
          const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (s.projects.some((p) => p.id === id)) return s;
          return { projects: [...s.projects, createProject(id, cleanName)] };
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
          const pricingModelId = s.selectedModelId === "auto" ? "anthropic/claude-sonnet-4" : s.selectedModelId;
          const model = getModel(pricingModelId);
          const msgs = [...active.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content, tokensOut };
          }

          const prevOut = last?.tokensOut || 0;
          const deltaOut = tokensOut - prevOut;
          const costDelta = deltaOut * model.outputPrice;
          const updated = {
            ...active,
            messages: msgs,
            todayTokensOut: active.todayTokensOut + deltaOut,
            todayCost: active.todayCost + costDelta,
            totalCost: active.totalCost + costDelta,
          };

          return {
            projects: replaceActiveProject(s, updated),
            globalSpend: s.globalSpend + costDelta,
          };
        }),

      finalizeResponse: (tokensIn, tokensOut, confidence) =>
        set((s) => {
          const active = ensureDaily(getActiveProject(s));
          const pricingModelId = s.selectedModelId === "auto" ? "anthropic/claude-sonnet-4" : s.selectedModelId;
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
            };
          }

          const byModel = { ...active.todayByModel };
          const modelKey = model.name;
          const existing = byModel[modelKey] || { cost: 0, count: 0 };
          byModel[modelKey] = {
            cost: existing.cost + totalMsgCost,
            count: existing.count + 1,
          };

          const updated = {
            ...active,
            messages: msgs,
            todayTokensIn: active.todayTokensIn + tokensIn,
            todayMessageCount: active.todayMessageCount + 1,
            todayByModel: byModel,
            todayCost: active.todayCost + inputCost,
            totalCost: active.totalCost + inputCost,
          };

          return {
            projects: replaceActiveProject(s, updated),
            globalSpend: s.globalSpend + inputCost,
          };
        }),

      markSettled: (messageId) =>
        set((s) => {
          const active = getActiveProject(s);
          const updated = {
            ...active,
            messages: active.messages.map((m) => (m.id === messageId ? { ...m, settled: true } : m)),
          };
          return { projects: replaceActiveProject(s, updated) };
        }),

      setStreaming: (v) =>
        set((s) => {
          const active = getActiveProject(s);
          const updated = { ...active, isStreaming: v };
          return { projects: replaceActiveProject(s, updated) };
        }),

      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setInspectorOpen: (v) => set({ inspectorOpen: v }),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),
      setSelectedModelId: (id) => set({ selectedModelId: id }),
      setSpendingCap: (v) => set({ spendingCap: v }),

      reset: () =>
        set((s) => ({
          projects: s.projects.map((p) => ({ ...p, messages: [], isStreaming: false })),
          globalSpend: 0,
        })),
    }),
    {
      name: "meter-store-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        userId: s.userId,
        email: s.email,
        authenticated: s.authenticated,
        cardOnFile: s.cardOnFile,
        selectedModelId: s.selectedModelId,
        spendingCap: s.spendingCap,
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        globalSpend: s.globalSpend,
      }),
    }
  )
);
