"use client";

import { useDecisionsStore, Decision } from "@/lib/decisions-store";

/* ─── Decision Row ──────────────────────────────────────────── */
function DecisionRow({
  decision,
  onRevisit,
}: {
  decision: Decision;
  onRevisit: (d: Decision) => void;
}) {
  const { archiveDecision } = useDecisionsStore();
  const isDecided = decision.status === "decided";

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-foreground/[0.02] transition-colors">
      {/* Status dot */}
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isDecided ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />

      {/* Title */}
      <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">
        {decision.title}
      </span>

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRevisit(decision);
          }}
          className="rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors"
        >
          revisit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            archiveDecision(decision.id);
          }}
          className="rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/40 hover:bg-foreground/10 hover:text-muted-foreground transition-colors"
        >
          archive
        </button>
      </div>

      {/* Badge (visible when not hovering) */}
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
  );
}

/* ─── Main Panel ────────────────────────────────────────────── */
export function DecisionsPanel({
  onRevisit,
}: {
  onRevisit: (d: Decision) => void;
}) {
  const { decisions, panelOpen } = useDecisionsStore();

  // Filter out archived, sort undecided first
  const visible = decisions
    .filter((d) => !d.archived)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "undecided" ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  if (!panelOpen) return null;

  return (
    <div className="max-h-[200px] overflow-y-auto border-t border-border/30">
      {visible.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <div className="font-mono text-[11px] text-muted-foreground/30">
            No decisions yet
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/20 mt-0.5">
            Decisions are logged as you chat
          </div>
        </div>
      ) : (
        <div className="py-1">
          {visible.map((d) => (
            <DecisionRow key={d.id} decision={d} onRevisit={onRevisit} />
          ))}
        </div>
      )}
    </div>
  );
}
