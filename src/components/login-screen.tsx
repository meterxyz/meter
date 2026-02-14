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
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 max-w-sm text-center">
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
            {busy ? "Waiting for device..." : "Get Started"}
          </button>

          {menuOpen && (
            <div className="absolute top-full mt-2 w-full max-w-[240px] rounded-lg border border-foreground/15 bg-[#1a1a1a] shadow-lg overflow-hidden z-50">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signupWithPasskey();
                }}
                className="w-full px-4 py-3 text-sm text-foreground text-left hover:bg-foreground/10 transition-colors border-b border-foreground/10"
              >
                <span className="font-medium">Create Passkey</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">New here? Set up your account</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  loginWithPasskey();
                }}
                className="w-full px-4 py-3 text-sm text-foreground text-left hover:bg-foreground/10 transition-colors"
              >
                <span className="font-medium">Sign in with Passkey</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Already have an account</span>
              </button>
            </div>
          )}
        </div>

          <span className="font-mono text-[10px] text-muted-foreground/60">
            powered by{" "}
            <a
              href="https://tempo.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              tempo
            </a>
          </span>
      </div>
    </div>
  );
}
