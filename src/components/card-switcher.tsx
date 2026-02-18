"use client";

import { useState, useRef, useEffect } from "react";

interface CardSwitcherProps {
  cardLast4: string | null;
}

export function CardSwitcher({ cardLast4 }: CardSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!cardLast4) return null;

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <span>{cardLast4}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-md border border-border bg-popover p-2 shadow-md z-50">
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider px-2 py-1">
            Cards
          </div>
          {/* Active billing card */}
          <div className="flex w-full items-center gap-2 rounded-md bg-foreground/10 px-2 py-1.5 font-mono text-[11px] text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {cardLast4}
            <span className="ml-auto text-[10px] text-muted-foreground/60">Billing</span>
          </div>
          {/* Future: payment cards, agent virtual cards */}
          <div className="mt-1 px-2 py-1.5 font-mono text-[10px] text-muted-foreground/30">
            Payment &amp; agent cards coming soon
          </div>
        </div>
      )}
    </div>
  );
}
