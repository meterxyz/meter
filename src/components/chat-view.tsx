"use client";

import { useRef, useEffect, useState } from "react";
import { useMeterStore, Settlement } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { ModelPicker } from "@/components/model-picker";
import { Inspector } from "@/components/inspector";
import { useWallets } from "@privy-io/react-auth";
import { formatMemo, txExplorerUrl } from "@/lib/tempo";
import { useSettlement } from "@/hooks/use-settlement";
import { getModel } from "@/lib/models";

/* ─── Receipt card (expandable) ────────────────────────────────── */
function ReceiptCard({ settlement }: { settlement: Settlement }) {
  const [open, setOpen] = useState(false);
  const statusColor =
    settlement.status === "settled"
      ? "text-emerald-500"
      : settlement.status === "failed"
      ? "text-red-400"
      : "text-yellow-500";
  const statusLabel =
    settlement.status === "settled"
      ? "settled"
      : settlement.status === "failed"
      ? "failed"
      : "settling...";

  return (
    <div className="mt-1">
      {/* Inline settlement summary */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{settlement.tokensIn} in</span>
        <span>{settlement.tokensOut} out</span>
        <span>${settlement.amount.toFixed(6)}</span>
        {/* Clickable receipt icon */}
        <button
          onClick={() => setOpen(!open)}
          className="hover:text-foreground transition-colors"
          title="Toggle receipt"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <path d="M8 10h8" />
            <path d="M8 14h4" />
          </svg>
        </button>
        {!open && (
          <span className={`${statusColor}`}>{statusLabel}</span>
        )}
      </div>

      {/* Expandable receipt card */}
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 font-mono text-[11px] max-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground font-medium">RECEIPT</span>
            <span className={`${statusColor} font-medium`}>{statusLabel}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tx</span>
              {settlement.txHash ? (
                <a
                  href={txExplorerUrl(settlement.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {settlement.txHash.slice(0, 10)}...{settlement.txHash.slice(-6)}
                </a>
              ) : (
                <span className="text-muted-foreground/50">awaiting...</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens</span>
              <span className="text-foreground">
                {settlement.tokensIn} in / {settlement.tokensOut} out
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost</span>
              <span className="text-foreground">${settlement.amount.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
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
    addEvent,
    sessionId,
    totalCost,
    maxSpend,
    settlements,
    addSettlement,
    updateSettlement,
    linkSettlementToMessage,
    selectedModelId,
  } = useMeterStore();

  const { wallets } = useWallets();
  const { settle } = useSettlement();
  const msgIndexRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedInspectorRef = useRef(false);

  const setInspectorOpen = useMeterStore((s) => s.setInspectorOpen);
  const setInspectorTab = useMeterStore((s) => s.setInspectorTab);

  const connectedWallet = wallets.find((w) => w.walletClientType !== "privy") ?? wallets[0];
  const walletAddress = connectedWallet?.address;

  // Auto-open inspector to wallet tab on first mount
  useEffect(() => {
    if (openedInspectorRef.current) return;
    openedInspectorRef.current = true;
    setInspectorOpen(true);
    setInspectorTab("wallet");
  }, [setInspectorOpen, setInspectorTab]);

  // No auto-scroll — user scrolls at their own pace

  const handleSend = async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    if (totalCost >= maxSpend) {
      addEvent("cap_hit", `Spend cap of $${maxSpend.toFixed(2)} reached`);
      return;
    }

    const userContent = input.value.trim();
    input.value = "";

    const userMsg = {
      id: Math.random().toString(36).slice(2, 10),
      role: "user" as const,
      content: userContent,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const assistantMsgId = Math.random().toString(36).slice(2, 10);
    const assistantMsg = {
      id: assistantMsgId,
      role: "assistant" as const,
      content: "",
      tokensOut: 0,
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);
    setStreaming(true);
    addEvent("tick", `Request sent: ${userContent.slice(0, 40)}...`);

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
      let finalUsage: { tokensIn: number; tokensOut: number } | null = null;
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
              finalUsage = { tokensIn: data.tokensIn, tokensOut: data.tokensOut };
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
            finalUsage = { tokensIn: data.tokensIn, tokensOut: data.tokensOut };
          }
        } catch {
          // ignore
        }
      }

      if (finalUsage) {
        finalizeResponse(finalUsage.tokensIn, finalUsage.tokensOut);
        addEvent("tick", `Response: ${finalUsage.tokensIn} in / ${finalUsage.tokensOut} out`);

        const msgIdx = msgIndexRef.current++;
        const currentModel = getModel(selectedModelId);
        const cost = finalUsage.tokensIn * currentModel.inputPrice + finalUsage.tokensOut * currentModel.outputPrice;
        const settlementId = Math.random().toString(36).slice(2, 10);
        const memo = formatMemo(sessionId, msgIdx);

        addSettlement({
          id: settlementId,
          txHash: "",
          sessionId,
          amount: cost,
          tokensIn: finalUsage.tokensIn,
          tokensOut: finalUsage.tokensOut,
          timestamp: Date.now(),
          status: "pending",
        });
        linkSettlementToMessage(assistantMsgId, settlementId);
        addEvent("tick", `Settling $${cost.toFixed(6)} on Tempo...`);

        try {
          const txHash = await settle(cost, walletAddress || "", msgIdx);
          updateSettlement(settlementId, { txHash, status: "settled" });
          addEvent("settlement_success", `$${cost.toFixed(6)} settled | tx: ${txHash.slice(0, 10)}... | memo: ${memo}`);
        } catch (txErr) {
          const errMsg = (txErr as Error).message;
          updateSettlement(settlementId, { status: "failed" });
          addEvent("settlement_fail", `Settlement failed: ${errMsg}`);
          console.warn("[settlement]", errMsg);
        }
      }
    } catch (err) {
      addEvent("settlement_fail", `Error: ${(err as Error).message}`);
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

  // Helper to find settlement for a message
  const getSettlement = (settlementId?: string) => {
    if (!settlementId) return null;
    return settlements.find((s) => s.id === settlementId) ?? null;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main chat area */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${inspectorOpen ? "mr-[380px]" : ""}`}>
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <img src="/logo-dark-copy.webp" alt="Meter" width={48} height={13} />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              pay per thought
            </span>
          </div>
          <button
            onClick={toggleInspector}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 hover:bg-foreground/5 transition-colors"
            title="Open inspector"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-muted-foreground transition-transform duration-200 ${inspectorOpen ? "rotate-180" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {/* Disclaimer bubble */}
            <div className="mb-4 flex justify-start">
              <div className="flex gap-2.5 max-w-[85%] rounded-xl px-4 py-3 bg-foreground/[0.03]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-muted-foreground/60">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="font-mono text-xs text-muted-foreground/60 leading-relaxed">
                  This session will stream charges from your wallet up to ${maxSpend.toFixed(2)}.
                  It stops automatically at the cap. You can pause or revoke anytime.
                </span>
              </div>
            </div>

            {messages.map((msg) => {
              const settlement = msg.role === "assistant" ? getSettlement(msg.settlementId) : null;

              return (
                <div key={msg.id} className="mb-4">
                  <div
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {/* Settlement line + expandable receipt */}
                      {msg.role === "assistant" && settlement && (
                        <ReceiptCard settlement={settlement} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

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

      {/* Inspector panel */}
      <Inspector />
    </div>
  );
}
