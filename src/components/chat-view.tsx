"use client";

import { useRef, useEffect, useState } from "react";
import { useMeterStore, ChatMessage } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { ModelPicker } from "@/components/model-picker";
import { Inspector } from "@/components/inspector";
import { getModel, shortModelName } from "@/lib/models";

function MessageFooter({ msg }: { msg: ChatMessage }) {
  const markSettled = useMeterStore((s) => s.markSettled);
  const hasCost = msg.cost !== undefined;

  const modelName = msg.model ? shortModelName(msg.model) : "—";
  const cost = msg.cost ?? 0;
  const confidence = msg.confidence ?? 0;
  const isSettled = msg.settled ?? false;

  useEffect(() => {
    if (!isSettled && hasCost) {
      const timer = setTimeout(() => markSettled(msg.id), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCost, isSettled, msg.id, markSettled]);

  if (!hasCost) return null;

  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted-foreground/60">
      <span
        className="text-muted-foreground/80"
        style={{ color: msg.model ? getModel(msg.model).color : undefined }}
      >
        {modelName}
      </span>
      <span className="text-muted-foreground/20">&middot;</span>
      <span>${cost.toFixed(cost < 0.01 ? 4 : 2)}</span>
      <span className="text-muted-foreground/20">&middot;</span>
      <span>{confidence}%</span>
      <span className="text-muted-foreground/20">&middot;</span>
      <span className={isSettled ? "text-emerald-500/70" : "text-yellow-500/70"}>
        {isSettled ? "settled" : "pending"}
      </span>
    </div>
  );
}

export function ChatView() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    globalSpend,
    addMessage,
    updateLastAssistantMessage,
    finalizeResponse,
    setStreaming,
    inspectorOpen,
    toggleInspector,
    spendingCap,
    selectedModelId,
  } = useMeterStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const messages = activeProject?.messages ?? [];
  const isStreaming = activeProject?.isStreaming ?? false;
  const todayCost = activeProject?.todayCost ?? 0;
  const todayMessageCount = activeProject?.todayMessageCount ?? 0;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSpendDropdown, setShowSpendDropdown] = useState(false);
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

    if (todayCost >= spendingCap) return;

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

      if (!res.ok) {
        const errBody = await res.text();
        let errMsg = `Chat API failed (${res.status})`;
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error) errMsg = parsed.error;
        } catch {
          // use default
        }
        throw new Error(errMsg);
      }

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
                confidence: data.confidence ?? 85,
              };
            }
          } catch {
            // skip malformed
          }
        }
      }

      if (buffer.trim().startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.type === "delta") {
            fullContent += data.content;
            updateLastAssistantMessage(fullContent, data.tokensOut);
          } else if (data.type === "usage") {
            finalUsage = {
              tokensIn: data.tokensIn,
              tokensOut: data.tokensOut,
              confidence: data.confidence ?? 85,
            };
          }
        } catch {
          // ignore
        }
      }

      if (finalUsage) {
        finalizeResponse(finalUsage.tokensIn, finalUsage.tokensOut, finalUsage.confidence);
      }
    } catch {
      // Error stays in chat
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
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Switching environment</p>
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
            <div className="relative">
              <button
                onClick={() => setShowSpendDropdown(!showSpendDropdown)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <span className="text-foreground">${globalSpend.toFixed(2)}</span>
                <span className="text-[9px] text-muted-foreground/40">global</span>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${showSpendDropdown ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showSpendDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSpendDropdown(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
                    <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Global Spend</div>
                    <div className="mb-3 font-mono text-lg text-foreground">${globalSpend.toFixed(2)}</div>
                    <div className="h-px bg-border" />
                    <div className="mt-3 space-y-1.5">
                      {projects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-muted-foreground">{project.name}</span>
                          <span className="font-mono text-[10px] text-foreground">${project.totalCost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

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
                <p className="text-sm text-muted-foreground">What are you building in {activeProject?.name ?? "this"}?</p>
                <p className="font-mono text-[10px] text-muted-foreground/40">Every model available. The meter runs in dollars.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="mb-4">
                <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-foreground/10 text-foreground" : "text-foreground"}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === "assistant" && <MessageFooter msg={msg} />}
                  </div>
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="mb-4 flex justify-start">
                <div className="flex gap-1 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 relative">
              <button
                onClick={() => setShowProjectDropdown((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-2.5 text-left transition-colors hover:bg-foreground/5"
              >
                <span className="text-sm text-foreground">{projects.length} environments</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${showProjectDropdown ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showProjectDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProjectDropdown(false)} />
                  <div className="absolute bottom-full z-50 mb-2 w-full rounded-xl border border-border bg-card p-2 shadow-xl">
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
                </>
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
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/50">{todayMessageCount} msgs today in {activeProject?.name ?? "—"}</p>
          </div>
        </div>
      </div>

      <Inspector />
    </div>
  );
}
