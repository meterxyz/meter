"use client";

import { useState, useEffect, useRef } from "react";
import { useMeterStore, selectConnectedServices } from "@/lib/store";
import { CONNECTORS } from "@/lib/connectors";
import { isApiKeyProvider, initiateOAuthFlow } from "@/lib/oauth-client";
import { ApiKeyDialog } from "@/components/api-key-dialog";

interface CommandBarProps {
  onSelectCommand: (prompt: string) => void;
}

export function CommandBar({ onSelectCommand }: CommandBarProps) {
  const connectedServices = useMeterStore(selectConnectedServices);
  const userId = useMeterStore((s) => s.userId);
  const activeProjectId = useMeterStore((s) => s.activeProjectId);
  const disconnectServiceRemote = useMeterStore((s) => s.disconnectServiceRemote);

  const [open, setOpen] = useState(false);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [apiKeyProvider, setApiKeyProvider] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside the composer card
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const card = containerRef.current?.closest(".rounded-xl");
      if (card && !card.contains(e.target as Node)) {
        setOpen(false);
        setExpandedConnector(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (!willOpen) setExpandedConnector(null);
    if (willOpen) {
      requestAnimationFrame(() => {
        const anchor = document.querySelector("[data-scroll-anchor]");
        anchor?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  function handleConnect(providerId: string) {
    if (!userId) return;
    if (isApiKeyProvider(providerId)) {
      setApiKeyProvider(providerId);
    } else {
      initiateOAuthFlow(providerId, userId, activeProjectId);
    }
  }

  function handleConnectorClick(connectorId: string, connected: boolean) {
    if (connected) {
      setExpandedConnector(expandedConnector === connectorId ? null : connectorId);
    } else {
      handleConnect(connectorId);
    }
  }

  const connectedCount = CONNECTORS.filter((c) => !!connectedServices[c.id]).length;

  return (
    <div ref={containerRef}>
      {/* Trigger bar */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 bg-foreground/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground/80"
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
          className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Connections
        {connectedCount > 0 && (
          <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/20 px-1 font-mono text-[9px] text-emerald-400">
            {connectedCount}
          </span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded connector list */}
      {open && (
        <div className="border-t border-border/50 bg-foreground/[0.03] py-0.5">
          {CONNECTORS.map((connector) => {
            const connected = !!connectedServices[connector.id];
            const expanded = expandedConnector === connector.id;
            return (
              <div key={connector.id}>
                {/* Connector row */}
                <button
                  onClick={() => handleConnectorClick(connector.id, connected)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 hover:bg-foreground/5 transition-colors"
                >
                  {/* Expand arrow for connected connectors */}
                  {connected ? (
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-muted-foreground/40 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  ) : (
                    <span className="w-2 shrink-0" />
                  )}
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-emerald-500">
                          Connected
                        </span>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectServiceRemote(connector.id);
                          }}
                          className="text-muted-foreground/40 hover:text-red-400 transition-colors"
                          title="Disconnect"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </span>
                      </div>
                    ) : (
                      <span className="rounded-md border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                        Connect
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded commands */}
                {connected && expanded && (
                  <div className="border-t border-border/30 bg-foreground/[0.02] py-0.5">
                    {connector.tools.map((tool) => (
                      <button
                        key={tool.function.name}
                        onClick={() => {
                          onSelectCommand(tool.chatPrompt);
                          setOpen(false);
                          setExpandedConnector(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 pl-[52px] text-left hover:bg-foreground/5 transition-colors"
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
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {apiKeyProvider && (
        <ApiKeyDialog
          provider={apiKeyProvider}
          onClose={() => setApiKeyProvider(null)}
        />
      )}
    </div>
  );
}
