"use client";

import Image from "next/image";
import { useLogin } from "@privy-io/react-auth";
import { useState, useRef, useEffect } from "react";


export function LoginScreen() {
  const { login } = useLogin();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

    return (
    <div className="relative flex h-screen flex-col items-center bg-background px-4">
          {/* Main content — upper third */}
          <div className="flex flex-col items-center gap-8 max-w-sm text-center mt-[28vh]">
          <div className="flex flex-col items-center gap-4">
            <button onClick={() => {}} className="cursor-pointer">
              <Image
                src="/logo-dark-copy.webp"
                alt="Meter"
                width={108}
                height={29}
                priority
              />
            </button>
            <p className="font-mono text-xs text-muted-foreground tracking-wide uppercase">
              pay per thought
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 w-full relative" ref={menuRef}>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time pay-per-thought billing for AI.
            </p>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Every token counted. Every cent settled.
            </p>
            <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-full h-10 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90 active:bg-foreground/80"
              >
                Get Started
              </button>

              {menuOpen && (
                  <div className="absolute top-full mt-1.5 w-full rounded-xl border border-white/[0.06] bg-[#1a1a1a] shadow-xl shadow-black/30 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        login();
                      }}
                      className="w-full px-4 py-3.5 text-[13px] text-foreground text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.06] flex items-center gap-3"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70 shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none"/></svg>
                      <div>
                        <span className="font-medium">Try the Demo</span>
                        <span className="block text-[11px] text-muted-foreground/60 mt-0.5">Chat with real-time billing</span>
                      </div>
                    </button>
                    <a
                      href={typeof window !== "undefined" && (window.location.hostname === "getmeter.xyz" || window.location.hostname === "www.getmeter.xyz") ? "https://dev.getmeter.xyz" : "/console"}
                      onClick={() => setMenuOpen(false)}
                      className="w-full px-4 py-3.5 text-[13px] text-foreground text-left hover:bg-white/[0.04] transition-colors flex items-center gap-3"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70 shrink-0"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>
                      <div>
                        <span className="font-medium">Developer Console</span>
                        <span className="block text-[11px] text-muted-foreground/60 mt-0.5">API keys &amp; integration</span>
                      </div>
                    </a>
                  </div>
                )}
          </div>
        </div>

        {/* Footer — pinned to bottom */}
        <div className="absolute bottom-8 flex flex-col items-center gap-3">
          <a
            href="https://tempo.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Built on Tempo
          </a>
          <div className="flex items-center gap-3">
            <a href="https://x.com/maboroshi_xyz" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/maboroshi-xyz" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a
              href="/docs"
              className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors border border-muted-foreground/20 rounded px-2 py-0.5 hover:border-muted-foreground/40"
            >
              Docs
            </a>
          </div>
        </div>
      </div>
  );
}
