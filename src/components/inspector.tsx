"use client";

import { useMeterStore } from "@/lib/store";

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    todayCost,
    todayTokensIn,
    todayTokensOut,
    todayMessageCount,
    todayByModel,
    spendingCap,
    setSpendingCap,
    email,
    logout,
    messages,
  } = useMeterStore();

  if (!inspectorOpen) return null;

  const tabs = ["usage", "billing", "settings"] as const;

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
              todayCost={todayCost}
              todayTokensIn={todayTokensIn}
              todayTokensOut={todayTokensOut}
              todayMessageCount={todayMessageCount}
              todayByModel={todayByModel}
              spendingCap={spendingCap}
              messages={messages}
            />
          )}
          {inspectorTab === "billing" && <BillingTab />}
          {inspectorTab === "settings" && (
            <SettingsTab
              email={email}
              spendingCap={spendingCap}
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
function UsageTab({
  todayCost,
  todayTokensIn,
  todayTokensOut,
  todayMessageCount,
  todayByModel,
  spendingCap,
  messages,
}: {
  todayCost: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayMessageCount: number;
  todayByModel: Record<string, { cost: number; count: number }>;
  spendingCap: number;
  messages: ReturnType<typeof useMeterStore.getState>["messages"];
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
          <span className="font-mono text-[10px] text-muted-foreground/40">
            of ${spendingCap.toFixed(0)} cap
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/40 transition-all duration-300"
            style={{ width: `${Math.min(100, (todayCost / spendingCap) * 100)}%` }}
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

      {/* Recent messages */}
      <div className="h-px bg-border" />
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Recent
        </div>
        {messages
          .filter((m) => m.role === "assistant" && m.cost !== undefined)
          .slice(-10)
          .reverse()
          .map((m) => (
            <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${m.settled ? "bg-emerald-500" : "bg-yellow-500"}`} />
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {m.content.slice(0, 40)}...
                </span>
              </div>
              <span className="font-mono text-[10px] text-foreground shrink-0">
                ${(m.cost ?? 0).toFixed(m.cost && m.cost < 0.01 ? 4 : 2)}
              </span>
            </div>
          ))}
        {messages.filter((m) => m.role === "assistant" && m.cost !== undefined).length === 0 && (
          <p className="font-mono text-[10px] text-muted-foreground/40 text-center py-4">
            No messages yet
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── BILLING TAB ─── */
function BillingTab() {
  return (
    <div className="flex flex-col gap-4">
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
            <span className="block text-[10px] text-muted-foreground/50">Expires 12/27</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Billing Cycle
        </div>
        <StatRow label="Next charge" value="At $10 or monthly" />
        <StatRow label="Current balance" value="$0.00" />
        <StatRow label="Last charged" value="—" />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          How Billing Works
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            Your card is charged when your balance reaches $10, or at the end of each month — whichever comes first.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            Each message shows its exact cost. No hidden fees, no subscription.
          </p>
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
}: {
  email: string | null;
  spendingCap: number;
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
        <p className="font-mono text-[10px] text-muted-foreground/40 mb-2">
          Stop sending messages once this limit is reached each day.
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-foreground">$</span>
          <input
            type="number"
            value={spendingCap}
            onChange={(e) => setSpendingCap(Number(e.target.value))}
            step={1}
            min={1}
            max={100}
            className="w-20 bg-transparent font-mono text-sm text-foreground border-b border-border focus:border-foreground focus:outline-none py-0.5"
          />
          <span className="font-mono text-[10px] text-muted-foreground/40">per day</span>
        </div>
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
