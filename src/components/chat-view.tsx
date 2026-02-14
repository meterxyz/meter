"use client";

import { useRef, useEffect } from "react";
import { useMeterStore } from "@/lib/store";
import { MeterPill } from "@/components/meter-pill";
import { Inspector } from "@/components/inspector";
import { usePrivy, useWallets, useCreateWallet } from "@privy-io/react-auth";
import { formatMemo } from "@/lib/tempo";
import { useSettlement } from "@/hooks/use-settlement";
import Image from "next/image";

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
    addSettlement,
    updateSettlement,
  } = useMeterStore();

  const { logout, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { settle, getAddress } = useSettlement();
  const msgIndexRef = useRef(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fundedRef = useRef(false);
    const walletCreatedRef = useRef(false);

    // Create embedded wallet if user doesn't have one yet
    useEffect(() => {
      if (!ready || !authenticated || walletCreatedRef.current) return;
      const hasEmbedded = wallets.some((w) => w.walletClientType === "privy");
      if (hasEmbedded) {
        walletCreatedRef.current = true;
        return;
      }
      walletCreatedRef.current = true;
      createWallet().catch((err) => {
        console.warn("[wallet] creation failed:", err);
      });
    }, [ready, authenticated, wallets, createWallet]);

    // Fund embedded wallet from Tempo testnet faucet once
    useEffect(() => {
      if (fundedRef.current) return;
      const addr = getAddress();
      if (!addr) return;
      fundedRef.current = true;
      fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            addEvent("tick", `Wallet funded on Tempo Moderato testnet`);
          }
        })
        .catch(() => {});
    }, [wallets, getAddress, addEvent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

    const assistantMsg = {
      id: Math.random().toString(36).slice(2, 10),
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
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) throw new Error("Chat API failed");

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

            // Process only complete lines (terminated by \n)
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
                // Genuinely malformed line, skip
              }
            }
          }

          // Process any remaining buffer content
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

            // Create settlement record and send real on-chain tx
            const msgIdx = msgIndexRef.current++;
            const INPUT_PRICE = 2.5 / 1_000_000;
            const OUTPUT_PRICE = 10 / 1_000_000;
            const cost = finalUsage.tokensIn * INPUT_PRICE + finalUsage.tokensOut * OUTPUT_PRICE;
            const settlementId = Math.random().toString(36).slice(2, 10);
            const memo = formatMemo(sessionId, msgIdx);

            // Add pending settlement
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
            addEvent("tick", `Settling $${cost.toFixed(6)} on Tempo...`);

              // Send real transaction
              try {
                const txHash = await settle(cost);
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

  return (
    <div className="flex h-screen bg-background">
      {/* Main chat area */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${inspectorOpen ? "mr-[380px]" : ""}`}>
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
                <Image src="/logo-dark-copy.webp" alt="Meter" width={48} height={13} />
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
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                    <Image src="/logo-dark-copy.webp" alt="Meter" width={84} height={23} />
                  <span className="font-mono text-xs text-muted-foreground">
                    every token counted. every cent settled.
                  </span>
                </div>
              )}

            {messages.map((msg) => (
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
                    {msg.role === "assistant" && msg.tokensOut !== undefined && msg.tokensOut > 0 && (
                      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        {msg.tokensIn && <span>{msg.tokensIn} in</span>}
                        <span>{msg.tokensOut} out</span>
                        {msg.cost !== undefined && (
                          <span>${msg.cost.toFixed(6)}</span>
                        )}
                      </div>
                    )}
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
