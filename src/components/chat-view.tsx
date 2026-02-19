"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useMeterStore, ChatMessage } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { ModelPickerTrigger, ModelPickerPanel } from "@/components/model-picker";
import { Inspector } from "@/components/inspector";
import { ProfileSettings } from "@/components/profile-settings";
import { ActionCard } from "@/components/action-card";
import { ApproveButton } from "@/components/approve-button";
import { ConnectorsBar } from "@/components/connectors-bar";
import { WorkspaceBar } from "@/components/workspace-bar";
import { getModel, shortModelName } from "@/lib/models";
import { useSessionSync } from "@/lib/use-session-sync";
import { useDecisionsStore } from "@/lib/decisions-store";
import ReactMarkdown from "react-markdown";

function statusLabel(msg: ChatMessage) {
  if (msg.receiptStatus === "settled") return "Settled";
  if (msg.receiptStatus === "signed") return "Signed";
  return "Signing";
}

function ErrorCard({ payload }: { payload: string }) {
  let model = "";
  try {
    const parsed = JSON.parse(payload);
    model = parsed.model ?? "";
  } catch { /* ignore */ }

  const modelLabel = model ? shortModelName(model) : "This model";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        <p className="font-mono text-[11px] text-foreground/70">
          {modelLabel} is temporarily unavailable across all providers. Please try again in a moment.
        </p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/0 transition-all group-hover/msg:text-muted-foreground/40 hover:!text-muted-foreground hover:bg-foreground/5"
      title={copied ? "Copied!" : "Copy message"}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

function DecisionPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 font-mono text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/10"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      Decision logged
    </button>
  );
}

const mdComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

function MessageFooter({ msg, projectId }: { msg: ChatMessage; projectId: string }) {
  const hasCost = msg.cost !== undefined;

  const modelName = msg.model ? shortModelName(msg.model) : "—";
  const cost = msg.cost ?? 0;
  const totalTokens = (msg.tokensIn ?? 0) + (msg.tokensOut ?? 0);
  const isSigned = msg.receiptStatus === "signed" || msg.receiptStatus === "settled";

  if (!hasCost) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
      <span style={{ color: msg.model ? getModel(msg.model).color : undefined }}>{modelName}</span>
      <span className="text-muted-foreground/30">&middot;</span>
      <span>{totalTokens.toLocaleString()} tokens</span>
      <span className="text-muted-foreground/30">&middot;</span>
      <span>${cost.toFixed(cost < 0.01 ? 4 : 3)}</span>
      <span className="text-muted-foreground/30">&middot;</span>
      {isSigned ? (
        <a
          href={`/receipt/${msg.id}?project=${projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 transition-colors ${msg.receiptStatus === "settled" ? "text-emerald-500/80 hover:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
          title="Open receipt"
        >
          {statusLabel(msg)}
          <span>↗</span>
        </a>
      ) : (
        <span className="text-yellow-500/80">{statusLabel(msg)}</span>
      )}
    </div>
  );
}

/* ─── Thinking / tool-use indicator with shimmer ─── */
const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  save_decision: "Saving decision",
  list_decisions: "Recalling decisions",
  get_current_datetime: "Checking date",
  search_emails: "Searching emails",
  read_email: "Reading email",
  github_create_repo: "Creating repo",
  github_list_repos: "Listing repos",
  github_create_issue: "Creating issue",
  vercel_deploy: "Deploying",
  vercel_list_deployments: "Listing deployments",
  stripe_list_payments: "Checking payments",
  stripe_get_balance: "Checking balance",
  stripe_list_subscriptions: "Listing subscriptions",
  mercury_get_accounts: "Checking accounts",
  mercury_list_transactions: "Listing transactions",
  ramp_list_transactions: "Listing expenses",
  ramp_get_spending_summary: "Summarizing spending",
  supabase_query: "Querying database",
  supabase_list_tables: "Listing tables",
};

function ThinkingIndicator({ toolName, rerouting }: { toolName?: string | null; rerouting?: { provider: string; toModel: string } | null }) {
  let label: string;
  if (rerouting) {
    const toLabel = shortModelName(rerouting.toModel);
    label = `Re-routing to ${toLabel}`;
  } else {
    label = toolName ? TOOL_LABELS[toolName] ?? toolName : "Thinking";
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 mb-4">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="meter-spinning text-muted-foreground/50"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="20 14" />
      </svg>
      <span className="thinking-shimmer text-sm font-medium select-none">
        {label}
      </span>
    </div>
  );
}

/* ─── Main ChatView ────────────────────────────────────────────── */
export function ChatView() {
  // Sync sessions to Supabase for eternal persistence
  useSessionSync();

  const {
    projects,
    activeProjectId,
    setActiveProject,
    addMessage,
    updateLastAssistantMessage,
    finalizeResponse,
    setStreaming,
    inspectorOpen,
    toggleInspector,
    spendingCap,
    spendingCapEnabled,
    selectedModelId,
    approveCard,
    rejectCard,
  } = useMeterStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const messages = activeProject?.messages ?? [];
  const isStreaming = activeProject?.isStreaming ?? false;
  const todayCost = activeProject?.todayCost ?? 0;
  const todayMessageCount = activeProject?.todayMessageCount ?? 0;

  const decisions = useDecisionsStore((s) => s.decisions);
  const updateDecision = useDecisionsStore((s) => s.updateDecision);

  const meterProjectId = useMemo(() => {
    const meterProject = projects.find(
      (p) => p.id === "meter" || p.name?.toLowerCase() === "meter"
    );
    return meterProject?.id ?? null;
  }, [projects]);

  useEffect(() => {
    if (!meterProjectId) return;
    const unassigned = decisions.filter((d) => !d.projectId);
    if (unassigned.length === 0) return;
    unassigned.forEach((d) => {
      updateDecision(d.id, { projectId: meterProjectId });
    });
  }, [decisions, meterProjectId, updateDecision]);

  const userId = useMeterStore((s) => s.userId);
  const chatBlocked = activeProject?.chatBlocked ?? false;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [switchingProjectName, setSwitchingProjectName] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [rerouting, setRerouting] = useState<{ provider: string; toModel: string } | null>(null);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const logoMenuRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const scrollAwayAtRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const hasInitialScrolled = useRef(false);

  useEffect(() => {
    hasInitialScrolled.current = false;
  }, [activeProjectId]);

  const pendingInput = useMeterStore((s) => s.pendingInput);
  const setPendingInput = useMeterStore((s) => s.setPendingInput);
  const setInspectorOpen = useMeterStore((s) => s.setInspectorOpen);
  const setInspectorTab = useMeterStore((s) => s.setInspectorTab);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelPickerOpen]);

  useEffect(() => {
    if (!logoMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setLogoMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [logoMenuOpen]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setInspectorOpen(true);
    setInspectorTab("usage");
  }, [setInspectorOpen, setInspectorTab]);

  const handleProjectSwitch = (projectId: string) => {
    if (projectId === activeProjectId) {
      setShowProjectDropdown(false);
      return;
    }
    const next = projects.find((p) => p.id === projectId);
    if (!next) return;
    setShowProjectDropdown(false);
    setSwitchingProjectName(next.name);
    setActiveProject(projectId);
    setTimeout(() => setSwitchingProjectName(null), 700);
  };

  // Detect user-initiated scroll-up via wheel / touch to pause auto-scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        userScrolledAwayRef.current = true;
        scrollAwayAtRef.current = Date.now();
      }
    };
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0].clientY > touchStartY) {
        userScrolledAwayRef.current = true;
        scrollAwayAtRef.current = Date.now();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isNearBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
    if (nearBottom && Date.now() - scrollAwayAtRef.current > 500) {
      userScrolledAwayRef.current = false;
    }
  }, []);

  // Auto-scroll using instant scrollTop (no smooth animation that fights
  // with user scroll). Guarded by isProgrammaticScrollRef so our own scroll
  // doesn't re-enter handleScroll and clear userScrolledAway.
  useEffect(() => {
    if (userScrolledAwayRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }
    isProgrammaticScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [messages]);

  const handleSend = async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    if (chatBlocked) {
      const userContent = input.value.trim();
      input.value = "";
      input.style.height = "auto";
      isNearBottomRef.current = true;
      userScrolledAwayRef.current = false;
      addMessage({
        id: Math.random().toString(36).slice(2, 10),
        role: "user",
        content: userContent,
        timestamp: Date.now(),
      });
      addMessage({
        id: Math.random().toString(36).slice(2, 10),
        role: "assistant",
        content: "Chat is paused. Please update your payment method or settle your outstanding balance to continue.",
        timestamp: Date.now(),
      });
      return;
    }

    if (spendingCapEnabled && todayCost >= spendingCap) return;

    const userContent = input.value.trim();
    input.value = "";
    input.style.height = "auto";

    isNearBottomRef.current = true;
    userScrolledAwayRef.current = false;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 10),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const assistantMsgId = Math.random().toString(36).slice(2, 10);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      tokensOut: 0,
      receiptStatus: "signing",
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);
    setStreaming(true);

    try {
      const allMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          model: selectedModelId,
          userId: userId || undefined,
          projectId: activeProjectId,
          connectedServices: Object.keys(connectedServices).filter(
            (k) => connectedServices[k]
          ),
        }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({ error: "Spend limit reached" }));
        updateLastAssistantMessage(body.error ?? "Spend limit reached. Please adjust your limits or wait for the next period.", 0);
        return;
      }
      if (!res.ok) throw new Error(`Chat API failed (${res.status})`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let finalUsage: { tokensIn: number; tokensOut: number; confidence: number } | null = null;
      let actualModelUsed: string | null = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload);
            if (data.type === "delta") {
              fullContent += data.content;
              setActiveTool(null);
              setRerouting(null);
              updateLastAssistantMessage(fullContent, data.tokensOut);
            } else if (data.type === "tool_call") {
              setActiveTool(data.name as string);
            } else if (data.type === "tool_result") {
              if (data.name === "save_decision" && data.decision) {
                const d = data.decision as { title: string; status: string; choice: string; alternatives?: string[]; reasoning?: string };
                const decId = useDecisionsStore.getState().addDecision({
                  title: d.title,
                  status: d.status === "decided" ? "decided" : "undecided",
                  choice: d.choice,
                  alternatives: d.alternatives,
                  reasoning: d.reasoning ?? undefined,
                  projectId: activeProjectId,
                });
                useMeterStore.getState().setMessageDecisionId(decId);
              }
            } else if (data.type === "rerouting") {
              // Show rerouting status line — the fallback system is switching models
              setRerouting({ provider: data.provider as string, toModel: data.to as string });
            } else if (data.type === "error") {
              const errorPayload = JSON.stringify({
                code: data.code,
                model: data.model,
              });
              fullContent = `__error__${errorPayload}`;
              updateLastAssistantMessage(fullContent, 0);
            } else if (data.type === "done") {
              if (data.actualModel) actualModelUsed = data.actualModel as string;
            } else if (data.type === "usage") {
              finalUsage = {
                tokensIn: data.tokensIn,
                tokensOut: data.tokensOut,
                confidence: data.confidence ?? 0,
              };
            }
          } catch {
            // noop
          }
        }
      }

      if (finalUsage) {
        finalizeResponse(finalUsage.tokensIn, finalUsage.tokensOut, finalUsage.confidence, actualModelUsed ?? undefined);
      }
    } catch {
      // keep silent for now
    } finally {
      setStreaming(false);
      setActiveTool(null);
      setRerouting(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Consume pendingInput from store (e.g. decision revisit) — send directly
  useEffect(() => {
    if (pendingInput && inputRef.current && !isStreaming) {
      inputRef.current.value = pendingInput;
      setPendingInput(null);
      handleSend();
    }
  }, [pendingInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectedServices = useMeterStore((s) => s.connectedServices);
  const logout = useMeterStore((s) => s.logout);

  const scrollToBottom = useCallback(() => {
    userScrolledAwayRef.current = false;
    setShowScrollBtn(false);
    const el = scrollRef.current;
    if (el) {
      isProgrammaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
    }
  }, []);

  const lastMsg = messages[messages.length - 1];
  const showThinking = isStreaming && (rerouting || activeTool || (lastMsg?.role === "assistant" && lastMsg.content === ""));

  return (
    <div className="flex h-screen bg-background">
      <ProfileSettings open={profileOpen} onClose={() => setProfileOpen(false)} />
      {switchingProjectName && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card px-8 py-6 text-center shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Switching workspace</p>
            <p className="mt-2 text-xl text-foreground">{switchingProjectName}</p>
          </div>
        </div>
      )}

      <div className={`relative flex flex-1 flex-col transition-all duration-300 ${inspectorOpen ? "mr-[380px]" : ""}`}>
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="relative flex items-center gap-2" ref={logoMenuRef}>
            <button
              onClick={() => setLogoMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-foreground/5"
            >
              <img src="/logo-dark-copy.webp" alt="Meter" width={72} height={20} />
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-muted-foreground/40"
              >
                <polyline points="7 10 12 5 17 10" />
                <polyline points="7 14 12 19 17 14" />
              </svg>
            </button>
            {logoMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-card shadow-xl py-1">
                <button
                  onClick={() => { setLogoMenuOpen(false); setProfileOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile Settings
                </button>
                <div className="mx-2 my-1 h-px bg-border" />
                <button
                  onClick={() => { setLogoMenuOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <div className="relative flex items-center gap-2">
            <ApproveButton />
            <button
              onClick={toggleInspector}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 transition-colors hover:bg-foreground/5"
              title="Open panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <p className="text-sm text-muted-foreground">What are you building in {activeProject?.name ?? "this workspace"}?</p>
                <p className="font-mono text-[10px] text-muted-foreground/40">Every model available. The meter runs in dollars.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="group/msg relative mb-4">
                <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-foreground/10 text-foreground" : "text-foreground"}`}>
                    {msg.role === "assistant" && msg.content && !msg.content.startsWith("__error__") && (
                      <CopyButton text={msg.content} />
                    )}
                    {msg.role === "assistant" && msg.content.startsWith("__error__") ? (
                      <ErrorCard payload={msg.content.slice("__error__".length)} />
                    ) : msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-a:text-blue-400">
                        <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}

                    {msg.cards && msg.cards.length > 0 && (
                      <div className="mt-2">
                        {msg.cards.map((card) => (
                          <ActionCard
                            key={card.id}
                            card={card}
                            onApprove={() => approveCard(msg.id, card.id)}
                            onReject={() => rejectCard(msg.id, card.id)}
                          />
                        ))}
                      </div>
                    )}

                    {msg.role === "assistant" && msg.decisionId && (
                      <DecisionPill onOpen={() => { setInspectorOpen(true); setInspectorTab("decisions"); }} />
                    )}
                    {msg.role === "assistant" && <MessageFooter msg={msg} projectId={activeProjectId} />}
                  </div>
                </div>
              </div>
            ))}

            {showThinking && <ThinkingIndicator toolName={activeTool} rerouting={rerouting} />}

            <div ref={bottomRef} data-scroll-anchor />
          </div>
        </div>

        {showScrollBtn && (
          <div className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center" style={{ zIndex: 20 }}>
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-colors hover:bg-foreground/5"
              title="Scroll to bottom"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Composer area */}
        <div className="p-4">
          <div className="mx-auto max-w-2xl">
            {/* Unified box */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Connectors bar — top section */}
              <ConnectorsBar />

              {/* Model picker + composer area */}
              <div ref={modelPickerRef}>
                {/* Model picker panel (expands inline) */}
                {modelPickerOpen && (
                  <>
                    <ModelPickerPanel onClose={() => setModelPickerOpen(false)} />
                    <div className="h-px bg-border" />
                  </>
                )}

                {/* Composer — middle section */}
                <div className="flex items-end gap-2 border-t border-border/50 p-2">
                  <ModelPickerTrigger
                    open={modelPickerOpen}
                    onToggle={() => setModelPickerOpen(!modelPickerOpen)}
                    overrideModelId={rerouting?.toModel ?? null}
                  />
                <textarea
                  ref={inputRef}
                  onKeyDown={handleKeyDown}
                  placeholder="Say something..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  style={{ maxHeight: "120px" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 120) + "px";
                  }}
                />
                <MeterPill />
                <button
                  onClick={handleSend}
                  disabled={isStreaming}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
                </div>
              </div>
            </div>

            {/* Workspace picker — plain text below the box */}
            <WorkspaceBar />
          </div>
        </div>
      </div>

      <Inspector />
    </div>
  );
}
