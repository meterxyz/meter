"use client";

import { useMeterStore, ChatMessage } from "@/lib/store";

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

  const tabs = ["wallet", "telemetry", "ledger", "permissions", "purchases", "hooks"] as const;

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
              todayCost={activeProject?.todayCost ?? 0}
              todayTokensIn={activeProject?.todayTokensIn ?? 0}
              todayTokensOut={activeProject?.todayTokensOut ?? 0}
              todayMessageCount={activeProject?.todayMessageCount ?? 0}
              todayByModel={activeProject?.todayByModel ?? {}}
              spendingCap={spendingCap}
              spendingCapEnabled={spendingCapEnabled}
              messages={activeProject?.messages ?? []}
              email={email}
            />
          )}
          {inspectorTab === "settings" && (
            <SettingsTab
              email={email}
              spendingCap={spendingCap}
              spendingCapEnabled={spendingCapEnabled}
              setSpendingCapEnabled={setSpendingCapEnabled}
              setSpendingCap={setSpendingCap}
            />
          )}
          {inspectorTab === "purchases" && <PurchasesTab />}
          {inspectorTab === "hooks" && <HooksTab events={events} />}
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
function UsageTab({
  todayCost,
  todayTokensIn,
  todayTokensOut,
  todayMessageCount,
  todayByModel,
  spendingCap,
  spendingCapEnabled,
  messages,
  email,
}: {
  todayCost: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayMessageCount: number;
  todayByModel: Record<string, { cost: number; count: number }>;
  spendingCap: number;
  spendingCapEnabled: boolean;
  messages: ChatMessage[];
  email: string | null;
}) {
  const settledCount = messages.filter((m) => m.role === "assistant" && m.settled).length;
  const pendingCount = messages.filter((m) => m.role === "assistant" && m.cost !== undefined && !m.settled).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Today's spend */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Today
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-mono text-2xl text-foreground">${todayCost.toFixed(2)}</span>
          {spendingCapEnabled && (
            <span className="font-mono text-[10px] text-muted-foreground/40">
              of ${spendingCap.toFixed(0)} cap
            </span>
          )}
        </div>
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/40 transition-all duration-300"
            style={{ width: `${Math.min(100, (todayCost / Math.max(spendingCap, 1)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Stats */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Activity
        </div>
        <StatRow label="Messages" value={todayMessageCount.toString()} />
        <StatRow label="Tokens In" value={todayTokensIn.toLocaleString()} />
        <StatRow label="Tokens Out" value={todayTokensOut.toLocaleString()} />
        <StatRow label="Settled" value={settledCount.toString()} />
        <StatRow label="Pending" value={pendingCount.toString()} />
      </div>

      <div className="h-px bg-border" />

      {/* By model */}
      {Object.keys(todayByModel).length > 0 && (
        <div>
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
            By Model
          </div>
          {Object.entries(todayByModel).map(([model, data]) => (
            <div key={model} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">{model}</span>
              <span className="text-xs text-foreground font-mono">
                ${data.cost.toFixed(2)} &middot; {data.count} msgs
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-border" />
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
            <span className="text-xs text-foreground font-mono">&bull;&bull;&bull;&bull; 4242</span>
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

      <button
        onClick={onRevoke}
        className="w-full rounded-lg border border-red-400/20 py-2 font-mono text-[11px] text-red-400 transition-colors hover:bg-red-400/10"
      >
        Revoke Session
      </button>
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

/* ─── HOOKS TAB ─── */
function HooksTab({ events }: { events: ReturnType<typeof useMeterStore.getState>["events"] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <span className="font-mono text-xs text-muted-foreground/60">No events yet</span>
        <span className="font-mono text-[10px] text-muted-foreground/40">
          Events stream here in real-time
        </span>
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
