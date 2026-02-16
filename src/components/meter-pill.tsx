"use client";

import { useMeterStore } from "@/lib/store";
import { MeterIcon } from "./meter-icon";

export function MeterPill() {
  const { projects, activeProjectId, toggleInspector } = useMeterStore();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <button
      onClick={toggleInspector}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <MeterIcon active={activeProject?.isStreaming ?? false} size={16} />
      <span>${(activeProject?.todayCost ?? 0).toFixed(2)}</span>
      <span className="text-[9px] text-muted-foreground/40">today</span>
    </button>
  );
}
