"use client";

import { useEffect, useRef, useState } from "react";
import { useMeterStore } from "@/lib/store";
import { MeterIcon } from "./meter-icon";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

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

function MidnightCountdown() {
  const [remaining, setRemaining] = useState(getMsUntilMidnight);

  useEffect(() => {
    const id = setInterval(() => setRemaining(getMsUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
        Resets in
      </div>
      <div className="font-mono text-lg tabular-nums text-foreground">
        {formatCountdown(remaining)}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/50">
        Today&apos;s spend meter resets at midnight local time.
      </p>
    </div>
  );
}

interface MeterPillProps {
  value?: number;
}

export function MeterPill({ value }: MeterPillProps) {
  const { projects, activeProjectId } = useMeterStore();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const today = value ?? activeProject?.todayCost ?? 0;
  const isStreaming = activeProject?.isStreaming ?? false;
  const animatedToday = useAnimatedNumber(today);

  const costStr = isStreaming
    ? `$${animatedToday.toFixed(4)}`
    : `$${animatedToday.toFixed(2)}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          title="Today's spend"
        >
          <MeterIcon active={isStreaming} size={16} />
          <span className="text-[12px] text-foreground tabular-nums">
            {costStr}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            today
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-56 p-3">
        <MidnightCountdown />
      </PopoverContent>
    </Popover>
  );
}
