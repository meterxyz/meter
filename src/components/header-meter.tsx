"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMeterStore } from "@/lib/store";
import { MeterIcon } from "./meter-icon";

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

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function startOfWeek(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function startOfMonth(): number {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return first.getTime();
}

export function HeaderMeter() {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(getMsUntilMidnight);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useMeterStore((s) => s.projects);
  const activeProjectId = useMeterStore((s) => s.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const todayCost = activeProject?.todayCost ?? 0;
  const isStreaming = activeProject?.isStreaming ?? false;

  const animatedToday = useAnimatedNumber(todayCost);
  const costStr = isStreaming
    ? `$${animatedToday.toFixed(4)}`
    : `$${animatedToday.toFixed(2)}`;

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setRemaining(getMsUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, [open]);

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

  const allMessages = useMemo(
    () => projects.flatMap((p) => p.messages),
    [projects]
  );

  const computePeriodCost = useCallback(
    (sinceTs: number) =>
      allMessages
        .filter((m) => m.role === "assistant" && m.cost != null && (m.timestamp ?? 0) >= sinceTs)
        .reduce((sum, m) => sum + (m.cost ?? 0), 0),
    [allMessages]
  );

  const weeklyCost = useMemo(() => computePeriodCost(startOfWeek()), [computePeriodCost]);
  const monthlyCost = useMemo(() => computePeriodCost(startOfMonth()), [computePeriodCost]);
  const lifetimeCost = useMemo(
    () =>
      allMessages
        .filter((m) => m.role === "assistant" && m.cost != null)
        .reduce((sum, m) => sum + (m.cost ?? 0), 0),
    [allMessages]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        title="Today's spend"
      >
        <MeterIcon active={isStreaming} size={14} />
        <span className="tabular-nums text-foreground">{costStr}</span>
        <span className="text-[10px] text-muted-foreground/50">today</span>
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border/50 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              Resets in
            </div>
            <div className="font-mono text-lg tabular-nums text-foreground">
              {formatCountdown(remaining)}
            </div>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground/50">
              Today&apos;s spend resets at midnight local time.
            </p>
          </div>

          <div className="px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">
              Spend
            </div>
            <div className="space-y-1.5">
              <SpendRow label="Today" amount={todayCost} />
              <SpendRow label="This week" amount={weeklyCost} />
              <SpendRow label="This month" amount={monthlyCost} />
              <SpendRow label="Lifetime" amount={lifetimeCost} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpendRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[11px] text-muted-foreground/70">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-foreground">
        ${amount.toFixed(2)}
      </span>
    </div>
  );
}
