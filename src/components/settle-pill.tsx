"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMeterStore } from "@/lib/store";
import { shortModelName } from "@/lib/models";

export function SettlePill() {
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useMeterStore((s) => s.projects);
  const pendingCharges = useMeterStore((s) => s.pendingCharges);
  const isSettling = useMeterStore((s) => s.isSettling);
  const settleAll = useMeterStore((s) => s.settleAll);
  const cardLast4 = useMeterStore((s) => s.cardLast4);
  const cardBrand = useMeterStore((s) => s.cardBrand);

  const pendingBalance = useMemo(() => {
    const msgCost = projects
      .flatMap((p) => p.messages)
      .filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled)
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);
    const cardCost = pendingCharges.reduce((sum, c) => sum + c.cost, 0);
    return msgCost + cardCost;
  }, [projects, pendingCharges]);

  const lineItems = useMemo(() => {
    const msgItems = projects.flatMap((p) =>
      p.messages
        .filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled)
        .map((m) => ({
          id: m.id,
          title: m.model ? shortModelName(m.model) : "AI Usage",
          cost: m.cost ?? 0,
          type: "usage" as const,
          timestamp: m.timestamp,
        }))
    );
    const cardItems = pendingCharges.map((c) => ({
      id: c.id,
      title: c.title,
      cost: c.cost,
      type: "card" as const,
      timestamp: Date.now(),
    }));
    return [...msgItems, ...cardItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [projects, pendingCharges]);

  const handleSettle = async () => {
    await settleAll();
    setSettled(true);
    setTimeout(() => {
      setSettled(false);
      setOpen(false);
    }, 1200);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const brandLabel = cardBrand
    ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)
    : "Card";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center rounded-lg border transition-colors font-mono text-[11px] ${
          settled
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : pendingBalance > 0
              ? "border-border hover:border-foreground/20"
              : "border-border text-muted-foreground"
        }`}
      >
        {/* Left: pending amount */}
        <span className="px-2.5 tabular-nums text-foreground">
          ${pendingBalance.toFixed(2)}
        </span>
        {/* Divider */}
        <span className="h-4 w-px bg-border" />
        {/* Right: settle label */}
        <span className="px-2.5 text-muted-foreground hover:text-foreground transition-colors">
          {settled ? "Settled" : isSettling ? "Settling..." : "Settle"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="border-b border-border px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Pending Charges
            </div>
          </div>

          {/* Line items */}
          <div className="max-h-[280px] overflow-y-auto">
            {lineItems.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="font-mono text-[11px] text-muted-foreground/40">
                  No pending charges
                </span>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.type === "card" ? "bg-blue-400" : "bg-amber-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-mono text-[11px] text-foreground/80">
                          {item.title}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground/40">
                          {item.type === "card" ? "Card purchase" : "AI usage"}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
                      ${item.cost.toFixed(item.cost < 0.01 ? 4 : 2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: total + pay button */}
          <div className="border-t border-border px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">Total</span>
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                ${pendingBalance.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleSettle}
              disabled={isSettling || pendingBalance <= 0}
              className={`w-full rounded-lg py-2 font-mono text-[11px] transition-colors ${
                settled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
              }`}
            >
              {settled
                ? "Settled"
                : isSettling
                  ? "Processing..."
                  : `Pay & Settle $${pendingBalance.toFixed(2)}`}
            </button>

            {cardLast4 && (
              <div className="text-center font-mono text-[9px] text-muted-foreground/40">
                Charged to {brandLabel} ····{cardLast4}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
