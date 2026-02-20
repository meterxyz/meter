"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { CONNECTORS, type ConnectorDef } from "@/lib/connectors";

export interface SlashCommandHandle {
  handleKey: (key: string) => boolean; // returns true if key was consumed
}

interface SlashCommandPopoverProps {
  open: boolean;
  query: string;
  connectedServices: Record<string, boolean>;
  onSelect: (chatPrompt: string) => void;
  onConnect: (providerId: string) => void;
  onClose: () => void;
}

export const SlashCommandPopover = forwardRef<SlashCommandHandle, SlashCommandPopoverProps>(
  function SlashCommandPopover({ open, query, connectedServices, onSelect, onConnect, onClose }, ref) {
    const [selectedConnector, setSelectedConnector] = useState<ConnectorDef | null>(null);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset state when popover opens/closes or query changes
    useEffect(() => {
      if (!open) {
        setSelectedConnector(null);
        setHighlightIndex(0);
      }
    }, [open]);

    // Reset highlight when query changes (level 1 filtering)
    useEffect(() => {
      if (!selectedConnector) {
        setHighlightIndex(0);
      }
    }, [query, selectedConnector]);

    // Filtered connectors for level 1
    const filteredConnectors = CONNECTORS.filter((c) =>
      !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase())
    );

    // Items for level 2 (tools of selected connector)
    const tools = selectedConnector?.tools ?? [];

    const currentItems = selectedConnector ? tools : filteredConnectors;
    const itemCount = currentItems.length;

    // Keep highlight in bounds
    useEffect(() => {
      if (highlightIndex >= itemCount) {
        setHighlightIndex(Math.max(0, itemCount - 1));
      }
    }, [highlightIndex, itemCount]);

    // Scroll highlighted item into view
    useEffect(() => {
      if (!listRef.current) return;
      const el = listRef.current.querySelector("[data-highlighted]");
      el?.scrollIntoView({ block: "nearest" });
    }, [highlightIndex]);

    const handleSelect = useCallback((index: number) => {
      if (selectedConnector) {
        // Level 2 — select a command
        const tool = tools[index];
        if (tool) onSelect(tool.chatPrompt);
      } else {
        // Level 1 — select a connector
        const connector = filteredConnectors[index];
        if (!connector) return;
        if (connectedServices[connector.id]) {
          setSelectedConnector(connector);
          setHighlightIndex(0);
        } else {
          onConnect(connector.id);
        }
      }
    }, [selectedConnector, tools, filteredConnectors, connectedServices, onSelect, onConnect]);

    const handleBack = useCallback(() => {
      if (selectedConnector) {
        setSelectedConnector(null);
        setHighlightIndex(0);
      } else {
        onClose();
      }
    }, [selectedConnector, onClose]);

    // Expose keyboard handler to parent
    useImperativeHandle(ref, () => ({
      handleKey(key: string): boolean {
        if (!open) return false;
        switch (key) {
          case "ArrowDown":
            setHighlightIndex((i) => (i + 1) % Math.max(1, itemCount));
            return true;
          case "ArrowUp":
            setHighlightIndex((i) => (i - 1 + Math.max(1, itemCount)) % Math.max(1, itemCount));
            return true;
          case "Enter":
            handleSelect(highlightIndex);
            return true;
          case "Escape":
            handleBack();
            return true;
          case "Backspace":
            if (!query && selectedConnector) {
              handleBack();
              return true;
            }
            return false;
          default:
            return false;
        }
      },
    }), [open, itemCount, highlightIndex, handleSelect, handleBack, query, selectedConnector]);

    if (!open || (filteredConnectors.length === 0 && !selectedConnector)) return null;

    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5">
              {selectedConnector ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  {selectedConnector.name}
                </button>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {query ? `Filtering: /${query}` : "/ Commands"}
                </span>
              )}
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-[240px] overflow-y-auto py-0.5">
              {selectedConnector ? (
                /* Level 2: Tool commands */
                tools.map((tool, i) => (
                  <button
                    key={tool.function.name}
                    data-highlighted={i === highlightIndex ? "" : undefined}
                    onClick={() => handleSelect(i)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                      i === highlightIndex ? "bg-foreground/5" : "hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground/40 shrink-0"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="font-mono text-[11px] text-foreground/80">
                      {tool.commandLabel}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/30 truncate">
                      {tool.function.description}
                    </span>
                  </button>
                ))
              ) : (
                /* Level 1: Connector list */
                filteredConnectors.map((connector, i) => {
                  const connected = !!connectedServices[connector.id];
                  return (
                    <button
                      key={connector.id}
                      data-highlighted={i === highlightIndex ? "" : undefined}
                      onClick={() => handleSelect(i)}
                      onMouseEnter={() => setHighlightIndex(i)}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                        i === highlightIndex ? "bg-foreground/5" : "hover:bg-foreground/[0.03]"
                      }`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-muted-foreground shrink-0"
                      >
                        <path d={connector.iconPath} />
                      </svg>
                      <span className="text-[13px] text-foreground shrink-0">{connector.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/40 truncate">
                        {connector.description}
                      </span>
                      <div className="ml-auto shrink-0">
                        {connected ? (
                          <span className="font-mono text-[10px] text-emerald-500/60">
                            {connector.tools.length} commands
                          </span>
                        ) : (
                          <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            Connect
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}

              {filteredConnectors.length === 0 && !selectedConnector && (
                <div className="px-3 py-3 text-center">
                  <p className="font-mono text-[11px] text-muted-foreground/40">No matching connections</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
