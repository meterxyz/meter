"use client";

import { useState } from "react";
import { useMeterStore } from "@/lib/store";
import { MODELS, getModel } from "@/lib/models";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function ModelPicker() {
  const [open, setOpen] = useState(false);
  const selectedModelId = useMeterStore((s) => s.selectedModelId);
  const setSelectedModelId = useMeterStore((s) => s.setSelectedModelId);
  const isStreaming = useMeterStore((s) => s.isStreaming);
  const model = getModel(selectedModelId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isStreaming}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-mono text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40 shrink-0"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: model.color }}
          />
          <span className="truncate max-w-[80px]">{model.name}</span>
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-56 p-1.5"
        sideOffset={8}
      >
        <div className="space-y-0.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedModelId(m.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-foreground/5 ${
                m.id === selectedModelId ? "bg-foreground/[0.07]" : ""
              }`}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: m.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {m.name}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {m.provider}
                </div>
              </div>
              {m.id === selectedModelId && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
