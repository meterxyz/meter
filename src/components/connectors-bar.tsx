"use client";

import { useState } from "react";
import { useMeterStore } from "@/lib/store";
import { CONNECTORS } from "@/lib/connectors";
import { isApiKeyProvider, initiateOAuthFlow } from "@/lib/oauth-client";
import { ApiKeyDialog } from "@/components/api-key-dialog";

export function ConnectorsBar() {
  const { connectedServices, userId, disconnectServiceRemote } = useMeterStore();
  const [apiKeyProvider, setApiKeyProvider] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const connectedCount = Object.values(connectedServices).filter(Boolean).length;

  function handleConnect(providerId: string) {
    if (!userId) return;
    if (isApiKeyProvider(providerId)) {
      setApiKeyProvider(providerId);
    } else {
      initiateOAuthFlow(providerId, userId);
    }
  }

  return (
    <>
      {/* Trigger bar */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider hover:text-muted-foreground/80 transition-colors"
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
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1 font-mono text-[9px] text-emerald-500">
            {connectedCount}
          </span>
        )}
      </button>

      {/* Expanded connector list */}
      {open && (
        <div className="border-t border-border/50 py-1">
          {CONNECTORS.map((connector) => {
            const connected = !!connectedServices[connector.id];
            return (
              <div
                key={connector.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-foreground/5 transition-colors"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-muted-foreground shrink-0"
                >
                  <path d={connector.iconPath} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{connector.name}</span>
                  <p className="font-mono text-[10px] text-muted-foreground/50 truncate">
                    {connector.description}
                  </p>
                </div>
                {connected ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[11px] text-emerald-500">
                      Connected
                    </span>
                    <button
                      onClick={() => disconnectServiceRemote(connector.id)}
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
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(connector.id)}
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                  >
                    Connect
                  </button>
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
    </>
  );
}
