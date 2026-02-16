"use client";

import { useRef, useEffect, useState } from "react";
import { useMeterStore, ChatMessage } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { ModelPicker } from "@/components/model-picker";
import { Inspector } from "@/components/inspector";
import { getModel, shortModelName } from "@/lib/models";

function statusLabel(msg: ChatMessage) {
  if (msg.receiptStatus === "settled") return "Settled";
  if (msg.receiptStatus === "signed") return "Signed";
  return "Signing";
}

function MessageFooter({ msg, projectId }: { msg: ChatMessage; projectId: string }) {
  const markSettled = useMeterStore((s) => s.markSettled);
  const hasCost = msg.cost !== undefined;

  const modelName = msg.model ? shortModelName(msg.model) : "—";
  const cost = msg.cost ?? 0;
  const totalTokens = (msg.tokensIn ?? 0) + (msg.tokensOut ?? 0);
  const isSigned = msg.receiptStatus === "signed" || msg.receiptStatus === "settled";

  useEffect(() => {
    if (msg.receiptStatus === "signed") {
      const timer = setTimeout(() => markSettled(msg.id), 3500);
      return () => clearTimeout(timer);
    }
  }, [msg.id, msg.receiptStatus, markSettled]);

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
          className="inline-flex items-center gap-1 text-emerald-500/80 transition-colors hover:text-emerald-400"
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

export function ChatView() {
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
  } = useMeterStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const messages = activeProject?.messages ?? [];
  const isStreaming = activeProject?.isStreaming ?? false;
  const todayCost = activeProject?.todayCost ?? 0;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [switchingProjectName, setSwitchingProjectName] = useState<string | null>(null);

  const setInspectorOpen = useMeterStore((s) => s.setInspectorOpen);
  const setInspectorTab = useMeterStore((s) => s.setInspectorTab);

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

  const handleSend = async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    if (spendingCapEnabled && todayCost >= spendingCap) return;

    const userContent = input.value.trim();
    input.value = "";
    input.style.height = "auto";

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
        body: JSON.stringify({ messages: allMessages, model: selectedModelId }),
      });

      if (!res.ok) throw new Error(`Chat API failed (${res.status})`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let finalUsage: { tokensIn: number; tokensOut: number; confidence: number } | null = null;
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
              updateLastAssistantMessage(fullContent, data.tokensOut);
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

      if (finalUsage) finalizeResponse(finalUsage.tokensIn, finalUsage.tokensOut, finalUsage.confidence);
    } catch {
      // keep silent for now
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {switchingProjectName && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card px-8 py-6 text-center shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Switching workspace</p>
            <p className="mt-2 text-xl text-foreground">{switchingProjectName}</p>
          </div>
        </div>
      )}

      <div className={`flex flex-1 flex-col transition-all duration-300 ${inspectorOpen ? "mr-[380px]" : ""}`}>
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <img src="/logo-dark-copy.webp" alt="Meter" width={48} height={13} />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {activeProject?.name} · ${activeProject?.totalCost.toFixed(2)} total
            </span>
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <p className="text-sm text-muted-foreground">What are you building in {activeProject?.name ?? "this workspace"}?</p>
                <p className="font-mono text-[10px] text-muted-foreground/40">Every model available. The meter runs in dollars.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="mb-4">
                <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-foreground/10 text-foreground" : "text-foreground"}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === "assistant" && <MessageFooter msg={msg} projectId={activeProjectId} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="mx-auto max-w-2xl">
            <div className="relative">
              <div className="absolute -top-12 left-3 z-20 w-[260px]">
                <button
                  onClick={() => setShowProjectDropdown((v) => !v)}
                  className="w-full rounded-xl border border-border bg-card/95 px-4 py-2 text-left shadow-lg backdrop-blur"
                >
                  <div className="text-sm text-foreground">{activeProject?.name ?? "Workspace"}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60">Switch project / startup</div>
                </button>

                {showProjectDropdown && (
                  <div className="mt-2 rounded-xl border border-border bg-card p-2 shadow-xl">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/5 ${project.id === activeProjectId ? "bg-foreground/[0.07]" : ""}`}
                      >
                        <div>
                          <div className="text-sm text-foreground">{project.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/60">${project.totalCost.toFixed(2)} total</div>
                        </div>
                        {project.id === activeProjectId && <span className="font-mono text-[10px] text-muted-foreground">active</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2">
                <ModelPicker />
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
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/50">{todayMessageCount} msgs today in {activeProject?.name ?? "—"}</p>
          </div>
        </div>
      </div>

      <Inspector />
    </div>
  );
}
