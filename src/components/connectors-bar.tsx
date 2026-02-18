"use client";

import { useMeterStore } from "@/lib/store";
import { CONNECTORS } from "@/lib/connectors";

export function ConnectorsBar() {
  const { connectedServices, connectService, disconnectService } =
    useMeterStore();

  return (
    <div className="flex items-center gap-1 bg-background px-3 py-2">
      <span className="mr-1 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
        Connectors
      </span>
      {CONNECTORS.map((c) => {
        const connected = !!connectedServices[c.id];
        return (
          <button
            key={c.id}
            onClick={() =>
              connected ? disconnectService(c.id) : connectService(c.id)
            }
            title={`${c.name}${connected ? " (connected)" : ""}`}
            className={`relative flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
              connected
                ? "border-border bg-foreground/5 text-foreground"
                : "border-transparent text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-border/50"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d={c.iconPath} />
            </svg>
            {/* Status dot */}
            <span
              className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-500" : "bg-muted-foreground/20"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
