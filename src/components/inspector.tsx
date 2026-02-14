"use client";

import { useMeterStore } from "@/lib/store";
import { txExplorerUrl } from "@/lib/tempo";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    sessionId,
    sessionStart,
    totalTokensIn,
    totalTokensOut,
    totalCost,
    burnRate,
    maxSpend,
    setMaxSpend,
    settlements,
    events,
  } = useMeterStore();

  const [activeTab, setActiveTab] = useState<"telemetry" | "ledger" | "permissions" | "hooks">("telemetry");
  const [elapsed, setElapsed] = useState(0);
  const { logout } = usePrivy();

  useEffect(() => {
    if (!inspectorOpen) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [inspectorOpen, sessionStart]);

  const capRemaining = Math.max(0, maxSpend - totalCost);
  const settlementInterval = 30; // seconds
  const nextSettlement = settlementInterval - (elapsed % settlementInterval);

    if (!inspectorOpen) return null;

    return (
      <>
      {/* Backdrop — click to close */}
      <div className="fixed inset-0 z-40" onClick={() => setInspectorOpen(false)} />
      <div className="fixed right-0 top-0 h-screen w-[380px] border-l border-border bg-card flex flex-col z-50">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          Session Meter Console
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
        {(["telemetry", "ledger", "permissions", "hooks"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              activeTab === tab
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
          {activeTab === "telemetry" && (
            <TelemetryTab
              sessionId={sessionId}
              elapsed={elapsed}
              totalTokensIn={totalTokensIn}
              totalTokensOut={totalTokensOut}
              totalCost={totalCost}
              burnRate={burnRate}
              capRemaining={capRemaining}
              maxSpend={maxSpend}
              nextSettlement={nextSettlement}
            />
          )}
          {activeTab === "ledger" && <LedgerTab settlements={settlements} />}
          {activeTab === "permissions" && (
            <PermissionsTab
              sessionId={sessionId}
              maxSpend={maxSpend}
              setMaxSpend={setMaxSpend}
              capRemaining={capRemaining}
            />
          )}
          {activeTab === "hooks" && <HooksTab events={events} />}
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

function StatRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function TelemetryTab({
  sessionId,
  elapsed,
  totalTokensIn,
  totalTokensOut,
  totalCost,
  burnRate,
  capRemaining,
  maxSpend,
  nextSettlement,
}: {
  sessionId: string;
  elapsed: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  burnRate: number;
  capRemaining: number;
  maxSpend: number;
  nextSettlement: number;
}) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Session
        </div>
        <StatRow label="ID" value={sessionId} />
        <StatRow label="Elapsed" value={formatTime(elapsed)} />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Token Flow
        </div>
        <StatRow label="Tokens In" value={totalTokensIn.toLocaleString()} />
        <StatRow label="Tokens Out" value={totalTokensOut.toLocaleString()} />
        <StatRow label="Total" value={(totalTokensIn + totalTokensOut).toLocaleString()} />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Billing
        </div>
        <StatRow label="Spent" value={`$${totalCost.toFixed(6)}`} />
        <StatRow label="Burn Rate" value={`$${burnRate.toFixed(6)}/s`} />
        <StatRow label="Cap" value={`$${maxSpend.toFixed(2)}`} />
        <StatRow label="Remaining" value={`$${capRemaining.toFixed(6)}`} />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Settlement
        </div>
        <StatRow label="Next Settlement" value={`${nextSettlement}s`} />
      </div>

      {/* Spend bar */}
      <div className="mt-2">
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/40 transition-all duration-300"
            style={{ width: `${Math.min(100, (totalCost / maxSpend) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[9px] text-muted-foreground/40">$0</span>
          <span className="font-mono text-[9px] text-muted-foreground/40">${maxSpend.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function LedgerTab({ settlements }: { settlements: ReturnType<typeof useMeterStore.getState>["settlements"] }) {
  if (settlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <span className="font-mono text-xs text-muted-foreground/60">No settlements yet</span>
        <span className="font-mono text-[10px] text-muted-foreground/40">
          Settlements appear here after each response
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {settlements.map((s) => (
        <div key={s.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`font-mono text-[10px] uppercase ${
                s.status === "settled"
                  ? "text-green-400"
                  : s.status === "failed"
                  ? "text-red-400"
                  : "text-yellow-400"
              }`}
            >
              {s.status}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {new Date(s.timestamp).toLocaleTimeString()}
            </span>
          </div>
            {s.amount > 0 ? (
              <>
                <StatRow label="Amount" value={`$${s.amount.toFixed(6)}`} />
                <StatRow label="Tokens" value={`${s.tokensIn} in / ${s.tokensOut} out`} />
              </>
            ) : (
              <StatRow label="Type" value="Faucet funding" />
            )}
            <div className="mt-1">
              {s.txHash ? (
                <a
                  href={txExplorerUrl(s.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-blue-400/70 hover:text-blue-400 font-mono break-all transition-colors"
                >
                  tx: {s.txHash}
                </a>
              ) : (
                <span className="text-[9px] text-muted-foreground/40 font-mono">
                  tx: awaiting...
                </span>
              )}
            </div>
          <div className="mt-0.5">
            <span className="text-[9px] text-muted-foreground/40 font-mono">
              memo: meter:{s.sessionId}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PermissionsTab({
  sessionId,
  maxSpend,
  setMaxSpend,
  capRemaining,
}: {
  sessionId: string;
  maxSpend: number;
  setMaxSpend: (v: number) => void;
  capRemaining: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Access Key
        </div>
        <StatRow label="Session" value={sessionId} />
        <StatRow label="Scope" value="chat:read, chat:write" />
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Spend Cap
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Max:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-foreground">$</span>
            <input
              type="number"
              value={maxSpend}
              onChange={(e) => setMaxSpend(Number(e.target.value))}
              step={0.1}
              min={0.1}
              className="w-20 bg-transparent font-mono text-xs text-foreground border-b border-border focus:border-foreground focus:outline-none py-0.5"
            />
          </div>
        </div>
        <div className="mt-2">
          <StatRow label="Remaining" value={`$${capRemaining.toFixed(6)}`} />
        </div>
      </div>

      <div className="h-px bg-border" />

      <button className="w-full rounded-lg border border-red-400/20 py-2 font-mono text-[11px] text-red-400 transition-colors hover:bg-red-400/10">
        Revoke Session
      </button>
    </div>
  );
}

function HooksTab({ events }: { events: ReturnType<typeof useMeterStore.getState>["events"] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <span className="font-mono text-xs text-muted-foreground/60">No events yet</span>
        <span className="font-mono text-[10px] text-muted-foreground/40">
          Events stream here in real-time
        </span>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    tick: "text-blue-400",
    settlement_success: "text-green-400",
    settlement_fail: "text-red-400",
    cap_hit: "text-yellow-400",
    revoke: "text-red-400",
  };

  return (
    <div className="flex flex-col gap-1">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-border/50">
          <span className={`font-mono text-[9px] uppercase shrink-0 ${typeColors[e.type] || "text-muted-foreground"}`}>
            {e.type}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground leading-tight">
            {e.message}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/40 shrink-0 ml-auto">
            {new Date(e.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
