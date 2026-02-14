"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ConsolePage() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const walletAddress = user?.wallet?.address ?? "";
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Fetch keys on auth
  useEffect(() => {
    if (!authenticated || !walletAddress) return;
    fetchKeys();
  }, [authenticated, walletAddress]);

  async function fetchKeys() {
    try {
      const res = await fetch(`/api/v1/keys?walletAddress=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
      }
    } catch {}
  }

  async function createKey() {
    setLoading(true);
    setNewKey(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        await fetchKeys();
      }
    } catch {}
    setLoading(false);
  }

  async function revokeKey(id: string) {
    try {
      await fetch(`/api/v1/keys?id=${id}`, { method: "DELETE" });
      await fetchKeys();
    } catch {}
  }

  function copyAddress() {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <img src="/meter-spin.gif" alt="Loading" className="w-8 h-8" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background px-4 gap-6">
        <Image src="/logo-dark-copy.webp" alt="Meter" width={108} height={29} priority />
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          Developer Console
        </p>
        <button
          onClick={login}
          className="h-10 px-6 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <a href="https://getmeter.xyz">
            <Image src="/logo-dark-copy.webp" alt="Meter" width={48} height={13} />
          </a>
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            dev console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://getmeter.xyz/docs"
            className="font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Docs
          </a>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 hover:bg-foreground/5 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="font-mono text-xs text-foreground">{shortAddress}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-[#1a1a1a] shadow-lg overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-border">
                <span className="font-mono text-[10px] text-muted-foreground/60 uppercase">Connected Wallet</span>
                <p className="font-mono text-[11px] text-foreground mt-0.5 break-all">{walletAddress}</p>
              </div>
              <button
                onClick={() => { copyAddress(); setDropdownOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-foreground/10 transition-colors"
              >
                {copied ? "Copied!" : "Copy address"}
              </button>
              <button
                onClick={() => { logout(); setDropdownOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-lg font-medium text-foreground mb-1">API Keys</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Manage your Meter API keys for programmatic access.
          </p>

          {/* New key banner */}
          {newKey && (
            <div className="mb-6 rounded-lg border border-green-400/20 bg-green-400/5 p-4">
              <p className="text-sm text-green-400 font-medium mb-1">New API key created</p>
              <p className="text-xs text-muted-foreground mb-2">Copy it now — you won&apos;t see it again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-xs text-foreground break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(newKey)}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Create key button */}
          <button
            onClick={createKey}
            disabled={loading}
            className="mb-6 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create New Key"}
          </button>

          {/* Keys table */}
          {keys.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Prefix</th>
                    <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Created</th>
                    <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{k.key_prefix}...</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{k.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-[10px] uppercase ${k.active ? "text-green-400" : "text-red-400"}`}>
                          {k.active ? "active" : "revoked"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {k.active && (
                          <button
                            onClick={() => revokeKey(k.id)}
                            className="font-mono text-[10px] text-red-400 hover:text-red-300 transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No API keys yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create one to get started</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
