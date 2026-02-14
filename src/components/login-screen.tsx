"use client";

import Image from "next/image";
import { useLoginWithPasskey, useSignupWithPasskey } from "@privy-io/react-auth";
import { useState, useRef, useEffect } from "react";

export function LoginScreen() {
  const { loginWithPasskey, state: loginState } = useLoginWithPasskey({
    onError: (err) => console.error("Passkey login error:", err),
  });
  const { signupWithPasskey, state: signupState } = useSignupWithPasskey({
    onError: (err) => console.error("Passkey signup error:", err),
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const signupBusy = signupState.status !== "initial" && signupState.status !== "error" && signupState.status !== "done";
  const loginBusy = loginState.status !== "initial" && loginState.status !== "error" && loginState.status !== "done";
  const busy = signupBusy || loginBusy;

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
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4 relative">
          <div className="flex flex-col items-center gap-8 max-w-sm text-center -mt-12">
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
            disabled={busy}
            className="w-full max-w-[240px] h-10 rounded-lg bg-foreground text-background text-sm font-medium transition-colors hover:bg-foreground/90 active:bg-foreground/80 disabled:opacity-50"
          >
            {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  Waiting for device...
                </span>
              ) : "Get Started"}
          </button>

            {menuOpen && (
              <div className="absolute top-full mt-2 w-full max-w-[240px] rounded-lg border border-foreground/15 bg-[#1a1a1a] shadow-lg overflow-hidden z-50">
                <button
                      onClick={() => {
                        setMenuOpen(false);
                        loginWithPasskey();
                      }}
                      className="w-full px-4 py-3 text-sm text-foreground text-left hover:bg-foreground/10 transition-colors border-b border-foreground/10"
                    >
                      <span className="font-medium">Sign in with Passkey</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">Already have an account</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signupWithPasskey();
                      }}
                      className="w-full px-4 py-3 text-sm text-foreground text-left hover:bg-foreground/10 transition-colors"
                    >
                      <span className="font-medium">Create Passkey</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">New here? Set up your account</span>
                    </button>
              </div>
            )}
        </div>

        </div>

          <div className="absolute bottom-6 flex flex-col items-center gap-3">
            <a
              href="https://tempo.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors"
            >
              Built on Tempo
            </a>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/tempodotxyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com/nicholaswinton2/meter-chat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                aria-label="GitHub"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="/docs"
                className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors border border-muted-foreground/15 rounded px-2 py-0.5 hover:border-muted-foreground/30"
              >
                Docs
              </a>
            </div>
          </div>
      </div>
  );
}
