"use client";

import { useRef, useEffect, useState } from "react";
import { useMeterStore, ChatMessage } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { ModelPicker } from "@/components/model-picker";
import { Inspector } from "@/components/inspector";
import { getModel, shortModelName } from "@/lib/models";

/* ─── Message footer: model · $cost · confidence% · settled ─── */
function MessageFooter({ msg }: { msg: ChatMessage }) {
  const markSettled = useMeterStore((s) => s.markSettled);
  const hasCost = msg.cost !== undefined;

  const modelName = msg.model ? shortModelName(msg.model) : "—";
  const cost = msg.cost ?? 0;
  const confidence = msg.confidence ?? 0;
  const isSettled = msg.settled ?? false;

  // Auto-mark as settled after a delay (simulates billing confirmation)
  useEffect(() => {
    if (!isSettled && hasCost) {
      const timer = setTimeout(() => markSettled(msg.id), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCost, isSettled, msg.id, markSettled]);

  if (!hasCost) return null;

  return (
    <div className="flex items-center gap-2 mt-2 font-mono text-[11px] text-muted-foreground/60">
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

/* ─── Main ChatView ────────────────────────────────────────────── */
export function ChatView() {
  const {
    messages,
    isStreaming,
    addMessage,
    updateLastAssistantMessage,
    finalizeResponse,
    setStreaming,
    inspectorOpen,
    toggleInspector,
    todayCost,
    spendingCap,
    selectedModelId,
    todayMessageCount,
    todayByModel,
  } = useMeterStore();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const setInspectorOpen = useMeterStore((s) => s.setInspectorOpen);
  const setInspectorTab = useMeterStore((s) => s.setInspectorTab);

  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setInspectorOpen(true);
    setInspectorTab("usage");
  }, [setInspectorOpen, setInspectorTab]);

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
        } catch { /* use default */ }
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
      <div className={`flex flex-1 flex-col transition-all duration-300 ${inspectorOpen ? "mr-[380px]" : ""}`}>
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <img src="/logo-dark-copy.webp" alt="Meter" width={48} height={13} />
          </div>
          <div className="flex items-center gap-2">
            {/* Daily meter */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
              >
                <span className="text-foreground">${todayCost.toFixed(2)}</span>
                <span className="text-muted-foreground/40 text-[9px]">today</span>
                <svg
                  width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showDropdown ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-xl z-50 p-4">
                    <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-3">
                      Today&apos;s Usage
                    </div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-mono text-lg text-foreground">${todayCost.toFixed(2)}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        of ${spendingCap.toFixed(0)} cap
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-border overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full bg-foreground/40 transition-all duration-300"
                        style={{ width: `${Math.min(100, (todayCost / spendingCap) * 100)}%` }}
                      />
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground/50 mb-3">
                      {todayMessageCount} messages
                    </div>
                    {Object.keys(todayByModel).length > 0 && (
                      <>
                        <div className="h-px bg-border mb-3" />
                        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
                          By Model
                        </div>
                        <div className="space-y-1.5">
                          {Object.entries(todayByModel).map(([model, data]) => (
                            <div key={model} className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-muted-foreground">{model}</span>
                              <span className="font-mono text-[10px] text-foreground">
                                ${data.cost.toFixed(2)} &middot; {data.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={toggleInspector}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 hover:bg-foreground/5 transition-colors"
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <p className="text-sm text-muted-foreground">What are you building?</p>
                <p className="font-mono text-[10px] text-muted-foreground/40">
                  Every model available. The meter runs in dollars.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="mb-4">
                <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-foreground/10 text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === "assistant" && <MessageFooter msg={msg} />}
                  </div>
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="mb-4 flex justify-start">
                <div className="flex gap-1 px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="mx-auto max-w-2xl">
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
        </div>
      </div>

      <Inspector />
    </div>
  );
}
