"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMeterStore } from "@/lib/store";
import { MeterIcon } from "./meter-icon";
import { getModel } from "@/lib/models";

function useAnimatedNumber(value: number, duration = 350) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = prevRef.current;
    const diff = value - from;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const next = from + diff * p;
      setDisplay(next);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

export function MeterPill() {
  const { projects, activeProjectId } = useMeterStore();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const [open, setOpen] = useState(false);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * dayMs;
  const monthAgo = now - 30 * dayMs;

  const stats = useMemo(() => {
    const assistantMsgs = (activeProject?.messages ?? []).filter((m) => m.role === "assistant" && m.cost !== undefined);

    const today = activeProject?.todayCost ?? 0;
    const week = assistantMsgs.filter((m) => m.timestamp >= weekAgo).reduce((sum, m) => sum + (m.cost ?? 0), 0);
    const month = assistantMsgs.filter((m) => m.timestamp >= monthAgo).reduce((sum, m) => sum + (m.cost ?? 0), 0);
    const all = activeProject?.totalCost ?? 0;

    const tokensToday = (activeProject?.todayTokensIn ?? 0) + (activeProject?.todayTokensOut ?? 0);
    const messagesToday = activeProject?.todayMessageCount ?? 0;

    const byModel = Object.entries(activeProject?.todayByModel ?? {})
      .map(([name, data]) => ({
        name,
        cost: data.cost,
        share: today > 0 ? Math.round((data.cost / today) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);

    const opus = getModel("anthropic/claude-opus-4");
    const out = activeProject?.todayTokensOut ?? 0;
    const inTokens = activeProject?.todayTokensIn ?? 0;
    const opusCost = inTokens * opus.inputPrice + out * opus.outputPrice;
    const actual = today;
    const saved = Math.max(0, opusCost - actual);

    return { today, week, month, all, tokensToday, messagesToday, byModel, saved };
  }, [activeProject, weekAgo, monthAgo]);

  const animatedToday = useAnimatedNumber(stats.today);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <MeterIcon active={activeProject?.isStreaming ?? false} size={16} />
        <span>${animatedToday.toFixed(2)}</span>
        <span className="text-[9px] text-muted-foreground/40">today</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-2 w-[300px] rounded-xl border border-border bg-card p-3.5 shadow-xl">
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Today</span><span>${stats.today.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This week</span><span>${stats.week.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">This month</span><span>${stats.month.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">All time</span><span>${stats.all.toFixed(2)}</span></div>
            </div>

            <div className="my-3 h-px bg-border" />

            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Today&apos;s breakdown</div>
            <div className="mt-2 space-y-1.5">
              {stats.byModel.map((row) => (
                <div key={row.name} className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-muted-foreground">◆ {row.name}</span>
                  <span>{row.share}% · ${row.cost.toFixed(2)}</span>
                </div>
              ))}
              {stats.byModel.length === 0 && <div className="font-mono text-[10px] text-muted-foreground/50">No usage yet today.</div>}
            </div>

            <div className="my-3 h-px bg-border" />

            <div className="font-mono text-[10px] text-muted-foreground/80">
              {stats.messagesToday} messages · {(stats.tokensToday / 1000).toFixed(1)}K tokens
            </div>
            <div className="mt-1 font-mono text-[10px] text-emerald-500/80">
              Auto-routing saved ${stats.saved.toFixed(2)} vs all-Opus today
            </div>
          </div>
        </>
      )}
    </div>
  );
}
