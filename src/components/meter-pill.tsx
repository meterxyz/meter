"use client";

import { useMeterStore } from "@/lib/store";
import { MeterIcon } from "./meter-icon";

export function MeterPill() {
  const { todayCost, isStreaming, toggleInspector } = useMeterStore();

  return (
    <button
      onClick={toggleInspector}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <MeterIcon active={isStreaming} size={16} />
      <span>${todayCost.toFixed(2)}</span>
      <span className="text-muted-foreground/40 text-[9px]">today</span>
    </button>
  );
}
