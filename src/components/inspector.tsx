"use client";

import { useState, useMemo } from "react";
import { useMeterStore, ChatMessage } from "@/lib/store";
import { useDecisionsStore, Decision } from "@/lib/decisions-store";

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    projects,
    activeProjectId,
    spendingCap,
    setSpendingCap,
    spendingCapEnabled,
    setSpendingCapEnabled,
    email,
    logout,
  } = useMeterStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  if (!inspectorOpen) return null;

  const tabs = ["usage", "purchases", "decisions", "settings"] as const;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setInspectorOpen(false)} />
      <div className="fixed right-0 top-0 h-screen w-[380px] border-l border-border bg-card flex flex-col z-50">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Meter
          </span>
          <button
            onClick={() => setInspectorOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setInspectorTab(tab)}
              className={`flex-1 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                inspectorTab === tab
                  ? "text-foreground border-b border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {inspectorTab === "usage" && (
            <UsageTab
              activeProject={activeProject}
              allProjects={projects}
              email={email}
            />
          )}
          {inspectorTab === "purchases" && <PurchasesTab />}
          {inspectorTab === "decisions" && <DecisionsTab />}
          {inspectorTab === "settings" && (
            <SettingsTab
              email={email}
              spendingCap={spendingCap}
              spendingCapEnabled={spendingCapEnabled}
              setSpendingCapEnabled={setSpendingCapEnabled}
              setSpendingCap={setSpendingCap}
            />
          )}
        </div>

        {/* Sign out */}
        <div className="border-t border-border p-4">
          <button
            onClick={logout}
            className="w-full rounded-lg border border-border py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground font-mono">{value}</span>
    </div>
  );
}

/* ─── USAGE TAB ─── */
interface ProjectLike {
  messages: ChatMessage[];
  todayCost: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayMessageCount: number;
  todayByModel: Record<string, { cost: number; count: number }>;
  totalCost: number;
}

function UsageTab({
  activeProject,
  allProjects,
  email,
}: {
  activeProject: ProjectLike | undefined;
  allProjects: ProjectLike[];
  email: string | null;
}) {
  const cardLast4 = useMeterStore((s) => s.cardLast4);
  const cardBrand = useMeterStore((s) => s.cardBrand);

  const allMessages = allProjects.flatMap((p) => p.messages);
  const assistantMsgs = allMessages.filter((m) => m.role === "assistant" && m.cost !== undefined);

  const totalCost = allProjects.reduce((sum, p) => sum + p.totalCost, 0);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * dayMs;
    const monthAgo = now - 30 * dayMs;

    const today = activeProject?.todayCost ?? 0;
    const week = assistantMsgs
      .filter((m) => m.timestamp >= weekAgo)
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);
    const month = assistantMsgs
      .filter((m) => m.timestamp >= monthAgo)
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);

    const totalTokensIn = assistantMsgs.reduce((sum, m) => sum + (m.tokensIn ?? 0), 0);
    const totalTokensOut = assistantMsgs.reduce((sum, m) => sum + (m.tokensOut ?? 0), 0);
    const totalMessages = assistantMsgs.length;
    const settledCount = assistantMsgs.filter((m) => m.settled).length;
    const pendingCount = assistantMsgs.filter((m) => !m.settled).length;

    const byModel: Record<string, { cost: number; count: number }> = {};
    for (const m of assistantMsgs) {
      const key = m.model ?? "unknown";
      const existing = byModel[key] || { cost: 0, count: 0 };
      byModel[key] = { cost: existing.cost + (m.cost ?? 0), count: existing.count + 1 };
    }

    return { today, week, month, totalTokensIn, totalTokensOut, totalMessages, settledCount, pendingCount, byModel };
  }, [activeProject, assistantMsgs]);

  const brandLabel = cardBrand
    ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)
    : "Card";

  return (
    <div className="flex flex-col gap-4">
      {/* Lifetime spend */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Total Spend
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono text-2xl text-foreground">${totalCost.toFixed(2)}</span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground/60">Today</span>
            <span className="text-foreground/70">${stats.today.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/60">This week</span>
            <span className="text-foreground/70">${stats.week.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/60">This month</span>
            <span className="text-foreground/70">${stats.month.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Lifetime activity */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Activity
        </div>
        <StatRow label="Messages" value={stats.totalMessages.toString()} />
        <StatRow label="Tokens In" value={stats.totalTokensIn.toLocaleString()} />
        <StatRow label="Tokens Out" value={stats.totalTokensOut.toLocaleString()} />
        <StatRow label="Settled" value={stats.settledCount.toString()} />
        <StatRow label="Pending" value={stats.pendingCount.toString()} />
      </div>

      <div className="h-px bg-border" />

      {/* By model — lifetime */}
      {Object.keys(stats.byModel).length > 0 && (
        <>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
              By Model
            </div>
            {Object.entries(stats.byModel).map(([model, data]) => (
              <div key={model} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground">{model}</span>
                <span className="text-xs text-foreground font-mono">
                  ${data.cost.toFixed(2)} &middot; {data.count} msgs
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
        </>
      )}

      {/* Payment method */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Payment Method
        </div>
        <div className="rounded-lg border border-border p-3 flex items-center gap-3">
          <div className="h-8 w-12 rounded bg-foreground/10 flex items-center justify-center">
            <svg width="20" height="14" viewBox="0 0 24 16" fill="none" className="text-muted-foreground">
              <rect x="1" y="1" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <span className="text-xs text-foreground font-mono">
              {cardLast4 ? `${brandLabel} ····${cardLast4}` : "····4242"}
            </span>
            <span className="block text-[10px] text-muted-foreground/50">{email ?? "account"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SETTINGS TAB ─── */
function SettingsTab({
  email,
  spendingCap,
  setSpendingCap,
  spendingCapEnabled,
  setSpendingCapEnabled,
}: {
  email: string | null;
  spendingCap: number;
  spendingCapEnabled: boolean;
  setSpendingCapEnabled: (v: boolean) => void;
  setSpendingCap: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Account
        </div>
        <StatRow label="Email" value={email ?? "—"} />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Daily Spending Cap
        </div>
        <label className="mb-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/80">
          <input
            type="checkbox"
            checked={spendingCapEnabled}
            onChange={(e) => setSpendingCapEnabled(e.target.checked)}
          />
          Enable daily cap
        </label>
        {spendingCapEnabled && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-foreground">$</span>
            <input
              type="number"
              value={spendingCap}
              onChange={(e) => setSpendingCap(Number(e.target.value))}
              step={1}
              min={1}
              max={100}
              className="w-20 border-b border-border bg-transparent py-0.5 font-mono text-sm text-foreground focus:border-foreground focus:outline-none"
            />
            <span className="font-mono text-[10px] text-muted-foreground/40">per day</span>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Model Preferences
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/40">
          Auto-routing picks the best model per message. You can override per-message in the composer.
        </p>
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Data
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/40 mb-2">
          Your conversation persists as one eternal session.
        </p>
      </div>
    </div>
  );
}

/* ─── DECISIONS TAB ─── */
function DecisionRow({ decision }: { decision: Decision }) {
  const { archiveDecision, reopenDecision } = useDecisionsStore();
  const setPendingInput = useMeterStore((s) => s.setPendingInput);
  const [expanded, setExpanded] = useState(false);
  const isDecided = decision.status === "decided";

  const handleRevisit = () => {
    if (isDecided) reopenDecision(decision.id);
    const msg = isDecided
      ? `I want to revisit the decision "${decision.title}" — we chose "${decision.choice}". Can we reconsider this?`
      : `Let's discuss the open decision "${decision.title}" and make a call.`;
    setPendingInput(msg);
  };

  return (
    <div className="rounded-md transition-colors">
      {/* Header row */}
      <div
        className="group flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-foreground/[0.02]"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isDecided ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">
          {decision.title}
        </span>
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handleRevisit(); }}
            className="rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/40 hover:bg-foreground/10 hover:text-muted-foreground transition-colors"
          >
            revisit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); archiveDecision(decision.id); }}
            className="rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/40 hover:bg-foreground/10 hover:text-muted-foreground transition-colors"
          >
            archive
          </button>
        </div>
        <span
          className={`group-hover:hidden shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
            isDecided
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-amber-500/10 text-amber-500"
          }`}
        >
          {isDecided ? "decided" : "open"}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="ml-6 mr-1 mb-2 mt-0.5 flex flex-col gap-1.5 border-l border-border/40 pl-3">
          {decision.choice && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Choice</span>
              <p className="font-mono text-[11px] text-foreground/70 mt-0.5">{decision.choice}</p>
            </div>
          )}
          {Array.isArray(decision.alternatives) && decision.alternatives.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Alternatives</span>
              <ul className="mt-0.5">
                {decision.alternatives.map((alt, i) => (
                  <li key={i} className="font-mono text-[11px] text-foreground/50 flex items-start gap-1.5">
                    <span className="text-muted-foreground/30 mt-px">-</span>
                    {alt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decision.reasoning && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Reasoning</span>
              <p className="font-mono text-[11px] text-foreground/50 mt-0.5">{decision.reasoning}</p>
            </div>
          )}
          {!decision.choice && !decision.reasoning && (!Array.isArray(decision.alternatives) || decision.alternatives.length === 0) && (
            <p className="font-mono text-[10px] text-muted-foreground/30 italic">No details recorded</p>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionsTab() {
  const { decisions } = useDecisionsStore();
  const visible = decisions
    .filter((d) => !d.archived)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "undecided" ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Decisions
        </div>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="font-mono text-xs text-muted-foreground/40">
              No decisions yet
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/30">
              Decisions are logged as you chat
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visible.map((d) => (
              <DecisionRow key={d.id} decision={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PURCHASES TAB ─── */
function PurchasesTab() {
  return (
    <div className="flex flex-col gap-4">
      {/* Virtual Cards */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Virtual Cards
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3 rounded-lg border border-dashed border-border">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span className="font-mono text-[11px] text-muted-foreground/40">
            No virtual cards yet
          </span>
          <button
            className="rounded-lg border border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5"
          >
            + New Card
          </button>
          <span className="font-mono text-[9px] text-muted-foreground/30">
            Provision cards for your AI agent to make purchases
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Purchase History */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Purchase History
        </div>
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="font-mono text-xs text-muted-foreground/40">No purchases yet</span>
          <span className="font-mono text-[10px] text-muted-foreground/30">
            Purchases made by your agent appear here
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Spend Controls */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Agent Spend Controls
        </div>
        <StatRow label="Daily Limit" value="$0.00" />
        <StatRow label="Monthly Limit" value="$0.00" />
        <StatRow label="Per-Transaction Max" value="$0.00" />
      </div>
    </div>
  );
}
