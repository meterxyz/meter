"use client";

import { useEffect, useRef, useState } from "react";
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

interface MeterPillProps {
  onClick?: () => void;
  value?: number;
}

export function MeterPill({ onClick, value }: MeterPillProps) {
  const { projects, activeProjectId } = useMeterStore();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const today = value ?? activeProject?.todayCost ?? 0;
  const animatedToday = useAnimatedNumber(today);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      title="Open usage drawer"
    >
      <MeterIcon active={activeProject?.isStreaming ?? false} size={16} />
      <span>${animatedToday.toFixed(2)}</span>
      <span className="text-[9px] text-muted-foreground/40">today</span>
    </button>
  );
}
