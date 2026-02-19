"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMeterStore } from "@/lib/store";
import { useDecisionsStore } from "@/lib/decisions-store";

export function ActionsBar() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const projects = useMeterStore((s) => s.projects);
  const activeProjectId = useMeterStore((s) => s.activeProjectId);
  const approveCard = useMeterStore((s) => s.approveCard);
  const rejectCard = useMeterStore((s) => s.rejectCard);
  const getPendingBalance = useMeterStore((s) => s.getPendingBalance);
  const settleAll = useMeterStore((s) => s.settleAll);
  const isSettling = useMeterStore((s) => s.isSettling);
  const setInspectorOpen = useMeterStore((s) => s.setInspectorOpen);
  const setInspectorTab = useMeterStore((s) => s.setInspectorTab);

  const decisions = useDecisionsStore((s) => s.decisions);
  const undecided = useMemo(
    () =>
      decisions.filter(
        (d) =>
          d.status === "undecided" &&
          !d.archived &&
          d.projectId &&
          d.projectId === activeProjectId
      ),
    [decisions, activeProjectId]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const pendingActions = useMemo(() => {
    const actions: Array<{ messageId: string; card: { id: string; title: string; description: string; cost?: number; status: string } }> = [];
    if (!activeProject) return actions;
    for (const msg of activeProject.messages) {
      if (!msg.cards) continue;
      for (const c of msg.cards) {
        if (c.status === "pending") {
          actions.push({ messageId: msg.id, card: c });
        }
      }
    }
    return actions;
  }, [activeProject]);

  const pendingBalance = getPendingBalance();
  const totalPending = pendingActions.length + undecided.length + (pendingBalance > 0.01 ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const [settleSuccess, setSettleSuccess] = useState(false);
  const handleSettle = async () => {
    const result = await settleAll();
    if (result.success) {
      setSettleSuccess(true);
      setTimeout(() => setSettleSuccess(false), 2000);
    }
  };

  const openDecisions = () => {
    setOpen(false);
    setInspectorOpen(true);
    setInspectorTab("decisions");
  };

  return (
    <div ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-foreground/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground/80"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        Actions
        {totalPending > 0 && (
          <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1 font-mono text-[9px] text-amber-400">
            {totalPending}
          </span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border/50 bg-foreground/[0.03] py-1">
          {pendingActions.length > 0 && (
            <div className="border-b border-border/30 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                Pending Actions
              </div>
              <div className="space-y-2">
                {pendingActions.map(({ messageId, card }) => (
                  <div key={card.id} className="rounded-lg border border-border/50 p-2.5 bg-background/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-foreground truncate">{card.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/50 truncate">{card.description}</p>
                      </div>
                      {card.cost != null && (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">${card.cost.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => { approveCard(messageId, card.id); }}
                        className="flex-1 rounded-md bg-emerald-500/10 py-1 font-mono text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { rejectCard(messageId, card.id); }}
                        className="flex-1 rounded-md bg-red-500/10 py-1 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {undecided.length > 0 && (
            <div className="border-b border-border/30 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                Open Decisions
              </div>
              <div className="space-y-1">
                {undecided.slice(0, 5).map((d) => (
                  <button
                    key={d.id}
                    onClick={openDecisions}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">{d.title}</span>
                  </button>
                ))}
                {undecided.length > 5 && (
                  <button
                    onClick={openDecisions}
                    className="w-full py-1 font-mono text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    +{undecided.length - 5} more
                  </button>
                )}
              </div>
            </div>
          )}

          {pendingBalance > 0.01 && (
            <div className="border-b border-border/30 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                Outstanding Balance
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm tabular-nums text-foreground">${pendingBalance.toFixed(2)}</span>
              </div>
              <button
                onClick={handleSettle}
                disabled={isSettling}
                className={`w-full rounded-lg py-1.5 font-mono text-[10px] transition-colors ${
                  settleSuccess
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
                }`}
              >
                {settleSuccess ? "Settled" : isSettling ? "Processing..." : `Pay & Settle $${pendingBalance.toFixed(2)}`}
              </button>
            </div>
          )}

          {totalPending === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="font-mono text-[11px] text-muted-foreground/40">Nothing to approve</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground/30">
                Actions, decisions, and settlements appear here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
