"use client";

import { useState, useMemo, useEffect } from "react";
import { useMeterStore, ChatMessage, PaymentCard } from "@/lib/store";
import { useDecisionsStore, Decision } from "@/lib/decisions-store";

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    projects,
    email,
    logout,
  } = useMeterStore();

  if (!inspectorOpen) return null;

  const tabs = ["usage", "purchases", "decisions", "settings"] as const;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setInspectorOpen(false)} />
      <div className="fixed right-0 top-0 h-screen w-[380px] border-l border-border bg-card flex flex-col z-50">
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

        <div className="flex-1 overflow-y-auto p-4">
          {inspectorTab === "usage" && <UsageTab allProjects={projects} />}
          {inspectorTab === "purchases" && <PurchasesTab />}
          {inspectorTab === "decisions" && <DecisionsTab />}
          {inspectorTab === "settings" && <SettingsTab email={email} />}
        </div>

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

function UsageTab({ allProjects }: { allProjects: ProjectLike[] }) {
  const allMessages = allProjects.flatMap((p) => p.messages);
  const assistantMsgs = allMessages.filter((m) => m.role === "assistant" && m.cost !== undefined);
  const totalCost = allProjects.reduce((sum, p) => sum + p.totalCost, 0);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfDay = now - (now % dayMs);
    const weekAgo = now - 7 * dayMs;
    const monthAgo = now - 30 * dayMs;

    const today = assistantMsgs
      .filter((m) => m.timestamp >= startOfDay)
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);
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
  }, [assistantMsgs]);

  return (
    <div className="flex flex-col gap-4">
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

      {Object.keys(stats.byModel).length > 0 && (
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
      )}
    </div>
  );
}

/* ─── SETTINGS TAB ─── */
function SettingsTab({ email }: { email: string | null }) {
  const userId = useMeterStore((s) => s.userId);
  const logout = useMeterStore((s) => s.logout);
  const [passkeys, setPasskeys] = useState<Array<{ credentialId: string; deviceType: string | null; backedUp: boolean; createdAt: string }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/auth/passkeys?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.passkeys) setPasskeys(data.passkeys); })
      .catch(() => {});
  }, [userId]);

  const handleDeleteAccount = async () => {
    if (!userId || deleteConfirm !== "delete my account") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Deletion failed" }));
        setDeleteError(body.error ?? "Deletion failed");
        setDeleting(false);
        return;
      }
      logout();
    } catch {
      setDeleteError("Deletion failed");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Account
        </div>
        <StatRow label="Email" value={email ?? "—"} />
        {passkeys.length > 0 && (
          <div className="mt-2">
            {passkeys.map((pk) => (
              <div key={pk.credentialId} className="flex items-center gap-2 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                <span className="text-xs text-muted-foreground">
                  Passkey{pk.deviceType ? ` (${pk.deviceType})` : ""}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground/40">
                  {pk.backedUp ? "Synced" : "Local"}
                </span>
              </div>
            ))}
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

      <div className="h-px bg-border" />

      {/* Danger Zone */}
      <div>
        <div className="font-mono text-[10px] text-red-400/60 uppercase tracking-wider mb-2">
          Danger Zone
        </div>
        <div className="rounded-lg border border-red-500/20 p-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 mb-3">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {!deleteOpen ? (
            <button
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-muted-foreground/60">
                Type <span className="text-foreground">delete my account</span> to confirm:
              </p>
              <input
                autoFocus
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-red-500/50"
                placeholder="delete my account"
              />
              {deleteError && (
                <p className="font-mono text-[10px] text-red-400">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); setDeleteError(null); }}
                  className="flex-1 rounded-lg border border-border py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "delete my account" || deleting}
                  className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-1.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
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
      <div
        className="group flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-foreground/[0.02]"
        onClick={() => setExpanded(!expanded)}
      >
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

/* ─── CARD VISUAL ─── */
const BRAND_COLORS: Record<string, string> = {
  visa: "from-blue-900/80 to-blue-700/60",
  mastercard: "from-orange-900/80 to-red-800/60",
  amex: "from-emerald-900/80 to-emerald-700/60",
  discover: "from-amber-900/80 to-amber-700/60",
};

function CardVisual({ card, index, isTop, onClick, onRemove, canRemove }: {
  card: PaymentCard;
  index: number;
  isTop: boolean;
  onClick: () => void;
  onRemove?: () => void;
  canRemove: boolean;
}) {
  const brandLabel = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  const gradient = BRAND_COLORS[card.brand] ?? "from-zinc-800 to-zinc-700";

  return (
    <div
      onClick={onClick}
      className={`relative w-full rounded-xl p-4 bg-gradient-to-br ${gradient} border border-white/10 cursor-pointer transition-all duration-200 ${
        isTop ? "shadow-lg" : "hover:-translate-y-1 shadow-md"
      }`}
      style={{
        marginTop: index > 0 ? "-52px" : undefined,
        zIndex: isTop ? 10 : 10 - index,
      }}
    >
      {card.isDefault && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400" />
      )}
      <div className="flex items-center justify-between mb-6">
        <svg width="28" height="20" viewBox="0 0 24 16" fill="none" className="text-white/60">
          <rect x="1" y="1" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="font-mono text-[10px] text-white/40 uppercase">{brandLabel}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-sm text-white/80 tracking-widest">{card.last4}</span>
        <span className="font-mono text-[10px] text-white/40">
          {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
        </span>
      </div>
      {isTop && canRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-2 right-2 rounded px-1.5 py-0.5 font-mono text-[9px] text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
        >
          remove
        </button>
      )}
    </div>
  );
}

/* ─── PURCHASES TAB ─── */
function PurchasesTab() {
  const cards = useMeterStore((s) => s.cards);
  const cardsLoading = useMeterStore((s) => s.cardsLoading);
  const fetchCards = useMeterStore((s) => s.fetchCards);
  const setDefaultCard = useMeterStore((s) => s.setDefaultCard);
  const removeCard = useMeterStore((s) => s.removeCard);
  const settlementHistory = useMeterStore((s) => s.settlementHistory);
  const settlementHistoryLoading = useMeterStore((s) => s.settlementHistoryLoading);
  const fetchSettlementHistory = useMeterStore((s) => s.fetchSettlementHistory);
  const spendLimits = useMeterStore((s) => s.spendLimits);
  const fetchSpendLimits = useMeterStore((s) => s.fetchSpendLimits);
  const updateSpendLimits = useMeterStore((s) => s.updateSpendLimits);
  const userId = useMeterStore((s) => s.userId);
  const getPendingBalance = useMeterStore((s) => s.getPendingBalance);
  const settleAll = useMeterStore((s) => s.settleAll);
  const isSettling = useMeterStore((s) => s.isSettling);
  const settlementError = useMeterStore((s) => s.settlementError);
  const clearSettlementError = useMeterStore((s) => s.clearSettlementError);
  const cardLast4 = useMeterStore((s) => s.cardLast4);
  const cardBrand = useMeterStore((s) => s.cardBrand);

  const [addingCard, setAddingCard] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState(false);

  const [dailyInput, setDailyInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");
  const [perTxnInput, setPerTxnInput] = useState("");

  useEffect(() => {
    fetchCards();
    fetchSettlementHistory();
    fetchSpendLimits();
  }, [fetchCards, fetchSettlementHistory, fetchSpendLimits]);

  useEffect(() => {
    setDailyInput(spendLimits.dailyLimit != null ? String(spendLimits.dailyLimit) : "");
    setMonthlyInput(spendLimits.monthlyLimit != null ? String(spendLimits.monthlyLimit) : "");
    setPerTxnInput(spendLimits.perTxnLimit != null ? String(spendLimits.perTxnLimit) : "");
  }, [spendLimits]);

  const sorted = useMemo(() => {
    return [...cards].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }, [cards]);

  const handleAddCard = async () => {
    if (!userId) return;
    setAddingCard(true);
    try {
      const res = await fetch("/api/billing/cards/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.clientSecret && typeof window !== "undefined") {
          const { loadStripe } = await import("@stripe/stripe-js");
          const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
          if (stripeJs) {
            const { error } = await stripeJs.confirmCardSetup(data.clientSecret, {
              payment_method: { card: { token: "tok_visa" } as unknown as import("@stripe/stripe-js").StripeCardElement },
            });
            if (!error) {
              await fetchCards();
            }
          }
        }
      }
    } catch { /* silent */ } finally {
      setAddingCard(false);
    }
  };

  const handleRemove = async (pmId: string) => {
    setRemoveError(null);
    const result = await removeCard(pmId);
    if (!result.success) {
      setRemoveError(result.error ?? "Failed to remove card");
    }
  };

  const canRemoveCards = cards.length > 1 || getPendingBalance() <= 0;

  const pendingBalance = getPendingBalance();
  const brandLabel = cardBrand ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1) : "Card";

  const handleSettle = async () => {
    if (settlementError) clearSettlementError();
    const result = await settleAll();
    if (result.success) {
      setSettleSuccess(true);
      setTimeout(() => setSettleSuccess(false), 2000);
    }
  };

  const saveLimitOnBlur = (field: keyof typeof spendLimits, raw: string) => {
    const val = raw.trim() === "" ? null : Number(raw);
    if (val !== null && isNaN(val)) return;
    updateSpendLimits({ [field]: val });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Settle */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Outstanding</span>
          <span className="font-mono text-sm font-medium tabular-nums text-foreground">
            ${pendingBalance.toFixed(2)}
          </span>
        </div>

        {settlementError && (
          <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <span className="font-mono text-[10px] text-red-400">{settlementError}</span>
            <p className="mt-0.5 font-mono text-[9px] text-red-400/60">Please update your card or try again.</p>
          </div>
        )}

        <button
          onClick={handleSettle}
          disabled={isSettling || pendingBalance <= 0}
          className={`w-full rounded-lg py-2 font-mono text-[11px] transition-colors ${
            settleSuccess
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
          }`}
        >
          {settleSuccess ? "Settled" : isSettling ? "Processing..." : `Pay & Settle $${pendingBalance.toFixed(2)}`}
        </button>

        {cardLast4 && pendingBalance > 0 && (
          <p className="mt-1.5 text-center font-mono text-[9px] text-muted-foreground/40">
            Charged to {brandLabel} {cardLast4}
          </p>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Payment Cards — Apple Wallet stack */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Payment Cards
        </div>
        {cardsLoading && cards.length === 0 ? (
          <div className="py-6 text-center font-mono text-[11px] text-muted-foreground/40">Loading cards...</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 rounded-lg border border-dashed border-border">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <span className="font-mono text-[11px] text-muted-foreground/40">No cards yet</span>
          </div>
        ) : (
          <div className="relative pb-2">
            {sorted.map((card, i) => (
              <CardVisual
                key={card.id}
                card={card}
                index={i}
                isTop={i === 0}
                onClick={() => { if (!card.isDefault) setDefaultCard(card.id); }}
                onRemove={() => handleRemove(card.id)}
                canRemove={canRemoveCards}
              />
            ))}
          </div>
        )}
        {removeError && (
          <p className="mt-1 font-mono text-[10px] text-red-400">{removeError}</p>
        )}
        <button
          onClick={handleAddCard}
          disabled={addingCard}
          className="mt-2 w-full rounded-lg border border-border py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 disabled:opacity-40"
        >
          {addingCard ? "Adding..." : "+ Add Card"}
        </button>
      </div>

      <div className="h-px bg-border" />

      {/* Settlement History */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Settlement History
        </div>
        {settlementHistoryLoading && settlementHistory.length === 0 ? (
          <div className="py-4 text-center font-mono text-[11px] text-muted-foreground/40">Loading...</div>
        ) : settlementHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <span className="font-mono text-xs text-muted-foreground/40">No settlements yet</span>
            <span className="font-mono text-[10px] text-muted-foreground/30">
              Settlements appear here as they happen
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {settlementHistory.map((s) => {
              const brandLabel = s.cardBrand
                ? s.cardBrand.charAt(0).toUpperCase() + s.cardBrand.slice(1)
                : "";
              return (
                <div key={s.id} className="flex items-center justify-between py-1.5 font-mono text-[11px]">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-foreground/80">
                      ${s.amount.toFixed(2)}
                      <span className="text-muted-foreground/40 ml-1.5">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </span>
                    <span className="text-[9px] text-muted-foreground/40">
                      {brandLabel} {s.cardLast4 ?? ""} &middot; {s.messageCount} msgs
                    </span>
                  </div>
                  <span className={`shrink-0 text-[9px] ${s.status === "succeeded" ? "text-emerald-500/60" : "text-red-400/60"}`}>
                    {s.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Spend Controls */}
      <div>
        <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
          Spend Controls
        </div>
        <div className="space-y-2">
          <LimitRow
            label="Daily Limit"
            value={dailyInput}
            onChange={setDailyInput}
            onBlur={() => saveLimitOnBlur("dailyLimit", dailyInput)}
          />
          <LimitRow
            label="Monthly Limit"
            value={monthlyInput}
            onChange={setMonthlyInput}
            onBlur={() => saveLimitOnBlur("monthlyLimit", monthlyInput)}
          />
          <LimitRow
            label="Per-Txn Max"
            value={perTxnInput}
            onChange={setPerTxnInput}
            onBlur={() => saveLimitOnBlur("perTxnLimit", perTxnInput)}
          />
        </div>
        <p className="mt-2 font-mono text-[9px] text-muted-foreground/30">
          Leave blank for no limit. Limits are enforced server-side.
        </p>
      </div>
    </div>
  );
}

function LimitRow({ label, value, onChange, onBlur }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs text-muted-foreground/50">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          min={0}
          step={1}
          placeholder="—"
          className="w-16 border-b border-border bg-transparent py-0.5 text-right font-mono text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
