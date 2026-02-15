"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const sidebarSections = [
  {
    label: "GET STARTED",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "how-it-works", label: "How It Works" },
      { id: "quickstart", label: "Quickstart" },
    ],
  },
  {
    label: "CONCEPTS",
    items: [
      { id: "pay-per-thought", label: "Pay Per Thought" },
      { id: "pricing", label: "Pricing" },
      { id: "session-keys", label: "Session Keys" },
      { id: "settlement", label: "Settlement" },
    ],
  },
  {
    label: "ARCHITECTURE",
    items: [
      { id: "tempo-network", label: "Tempo Network" },
      { id: "tip-20-tokens", label: "TIP-20 Tokens" },
    ],
  },
  {
    label: "DEVELOPERS",
    items: [
      { id: "platform", label: "Platform" },
      { id: "api-reference", label: "API Reference" },
      { id: "sdk", label: "SDK" },
      { id: "configuration", label: "Configuration" },
    ],
  },
];

const allItems = sidebarSections.flatMap((s) => s.items);

function getNav(currentId: string) {
  const idx = allItems.findIndex((i) => i.id === currentId);
  return {
    prev: idx > 0 ? allItems[idx - 1] : null,
    next: idx < allItems.length - 1 ? allItems[idx + 1] : null,
  };
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-[#141414] border border-white/[0.06] p-4 font-mono text-xs text-foreground overflow-x-auto mb-6 leading-relaxed">
      {children}
    </pre>
  );
}

function NavFooter({
  currentId,
  onNavigate,
}: {
  currentId: string;
  onNavigate: (id: string) => void;
}) {
  const { prev, next } = getNav(currentId);
  return (
    <div className="flex justify-between items-center mt-12 pt-6 border-t border-white/[0.06]">
      {prev ? (
        <button
          onClick={() => onNavigate(prev.id)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; {prev.label}
        </button>
      ) : (
        <div />
      )}
      {next ? (
        <button
          onClick={() => onNavigate(next.id)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {next.label} &rarr;
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState("introduction");
  const mainRef = useRef<HTMLElement>(null);

  const navigate = useCallback((id: string) => {
    setActive(id);
    mainRef.current?.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border">
        <div className="flex h-14 items-center px-5 border-b border-border">
            <Link href="/">
              <Image
                src="/logo-dark-copy.webp"
                alt="Meter"
                width={72}
                height={20}
              />
            </Link>
            <span className="ml-2.5 font-mono text-[12px] font-semibold text-muted-foreground/50 uppercase tracking-[0.14em]">
              DOCS
            </span>
          </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
          {sidebarSections.map((section) => (
            <div key={section.label}>
              <div className="px-3 mb-2 font-mono text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em]">
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                      active === item.id
                        ? "bg-white/[0.08] text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-4 flex items-center gap-3">
          <a
            href="https://x.com/meterxyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/meterxyz/meter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </aside>

      {/* Main content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-10 py-14 lg:px-20">
          <div className="max-w-2xl">
          {active === "introduction" && (
            <IntroductionSection onNavigate={navigate} />
          )}
          {active === "how-it-works" && (
            <HowItWorksSection onNavigate={navigate} />
          )}
          {active === "quickstart" && (
            <QuickstartSection onNavigate={navigate} />
          )}
          {active === "pay-per-thought" && (
            <PayPerThoughtSection onNavigate={navigate} />
          )}
          {active === "pricing" && (
            <PricingSection onNavigate={navigate} />
          )}
          {active === "session-keys" && (
            <SessionKeysSection onNavigate={navigate} />
          )}
          {active === "settlement" && (
            <SettlementSection onNavigate={navigate} />
          )}
          {active === "tempo-network" && (
            <TempoNetworkSection onNavigate={navigate} />
          )}
          {active === "tip-20-tokens" && (
            <TIP20Section onNavigate={navigate} />
          )}
          {active === "platform" && (
            <PlatformSection onNavigate={navigate} />
          )}
          {active === "api-reference" && (
            <ApiReferenceSection onNavigate={navigate} />
          )}
          {active === "sdk" && <SdkSection onNavigate={navigate} />}
          {active === "configuration" && (
            <ConfigurationSection onNavigate={navigate} />
          )}
        </div>
      </main>
    </div>
  );
}

type SectionProps = { onNavigate: (id: string) => void };

function IntroductionSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Introduction
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Meter is a pay-per-thought AI interface that meters every token in real
        time and settles payments on-chain via the Tempo network. No
        subscriptions, no credits — you pay only for what you use, streamed in
        real time.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Why Meter?
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Traditional AI billing is opaque. You buy credits in bulk, consume them
        invisibly, and have no idea what any single interaction cost. Meter flips
        this: a live cost ticker runs as the AI responds, and each message is
        settled as a blockchain transaction you can verify on-chain.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Key Features
      </h2>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-3 mb-6">
        <li>
          <strong className="text-foreground">Real-time cost metering</strong> —
          watch your spend tick up token by token as the AI streams its response
        </li>
        <li>
          <strong className="text-foreground">On-chain settlement</strong> —
          every response is settled as a pathUSD transfer on Tempo, with a
          clickable transaction hash
        </li>
        <li>
          <strong className="text-foreground">Session keys</strong> — one wallet
          signature authorizes the entire session. Zero popups after that
        </li>
        <li>
          <strong className="text-foreground">Multi-model</strong> — access
          Claude, GPT-5.2, Gemini, DeepSeek, Kimi and more via OpenRouter
        </li>
        <li>
          <strong className="text-foreground">Crypto-native privacy</strong> —
          no email, no account. Connect wallet, authorize, chat
        </li>
        <li>
          <strong className="text-foreground">Developer API</strong> — integrate
          metered AI into your own apps with a single API key
        </li>
      </ul>

      <NavFooter currentId="introduction" onNavigate={onNavigate} />
    </div>
  );
}

function HowItWorksSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        How It Works
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Meter connects three systems:
      </p>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-8">
        <li>
          <strong className="text-foreground">OpenRouter</strong> — routes to
          the best AI models (Claude, GPT-5.2, Gemini, DeepSeek, Kimi, etc.) and reports token
          usage
        </li>
        <li>
          <strong className="text-foreground">Privy wallet auth</strong> —
          connects MetaMask or any EVM wallet. No seed phrases to manage
        </li>
        <li>
          <strong className="text-foreground">Tempo network</strong> — a
          high-throughput EVM chain where settlements are recorded as pathUSD
          transfers
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Flow
      </h2>
      <ol className="list-decimal list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-3 mb-8">
        <li>User connects wallet via Privy</li>
        <li>
          User authorizes session — ONE wallet signature
          <div className="ml-4 mt-1 text-muted-foreground/70">
            → generates ephemeral session key in-memory
            <br />→ approves session key to spend pathUSD up to the cap
          </div>
        </li>
        <li>User sends a message</li>
        <li>Server streams AI response via SSE (OpenRouter)</li>
        <li>Client counts tokens and updates cost meter in real time</li>
        <li>On stream completion, session key calls transferFrom — no popup</li>
        <li>Settlement recorded on Tempo with tx hash in the ledger</li>
      </ol>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Session Key Pattern
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        The key innovation: on authorize, Meter generates an ephemeral private
        key in the browser. Your wallet approves this key to spend pathUSD up to
        your session cap via a standard ERC-20 approve(). Every message after
        that is settled by the session key calling transferFrom() directly —
        signed locally, sent via RPC, zero wallet popups.
      </p>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        The session key lives only in memory and is destroyed when you close the
        tab or revoke the session.
      </p>

      <NavFooter currentId="how-it-works" onNavigate={onNavigate} />
    </div>
  );
}

function QuickstartSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Quickstart
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Get Meter running locally in under a minute.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Prerequisites
      </h2>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-1 mb-6">
        <li>Node.js 18+ or Bun</li>
        <li>
          An OpenRouter API key (
          <a
            href="https://openrouter.ai/keys"
            className="text-foreground underline"
          >
            openrouter.ai/keys
          </a>
          )
        </li>
        <li>
          A Privy app ID (
          <a
            href="https://dashboard.privy.io"
            className="text-foreground underline"
          >
            dashboard.privy.io
          </a>
          )
        </li>
        <li>A MetaMask or EVM wallet</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Install
      </h2>
      <CodeBlock>{`git clone https://github.com/meterxyz/meter
cd meter
cp .env.example .env.local
bun install
bun dev`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Environment
      </h2>
      <CodeBlock>{`# .env.local
OPENROUTER_API_KEY=sk-or-...              # OpenRouter API key
NEXT_PUBLIC_PRIVY_APP_ID=cm...            # Privy app ID (chat)
NEXT_PUBLIC_PRIVY_CONSOLE_APP_ID=cm...    # Privy app ID (dev console)
NEXT_PUBLIC_SUPABASE_URL=https://...      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...       # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=ey...           # Supabase service role key`}</CodeBlock>

      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Open{" "}
        <a href="https://getmeter.xyz" className="text-foreground underline">
          getmeter.xyz
        </a>
        , connect your wallet, authorize a session, and start chatting. Your
        wallet is funded automatically from the testnet faucet on first connect.
      </p>

      <NavFooter currentId="quickstart" onNavigate={onNavigate} />
    </div>
  );
}

function PayPerThoughtSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Pay Per Thought
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Pay-per-thought is the billing model: you pay for each AI response
        proportional to its length, at the exact moment it&apos;s generated. No
        subscriptions. No credits. No invoices.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        How Billing Works
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Cost is calculated from the token usage reported by OpenRouter at the
        end of each streamed response:
      </p>
      <CodeBlock>{`cost = (input_tokens × input_rate) + (output_tokens × output_rate)`}</CodeBlock>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Meter adds a 10% markup on top of OpenRouter&apos;s base rates.
        That&apos;s the entire business model — no hidden fees, no platform tax.
        The markup pays for infrastructure, settlement gas, and the metering
        service.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Real-Time Metering
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        As the AI streams its response, the client counts tokens in real time
        and displays a live cost estimate in the meter pill. The final cost is
        determined by the server&apos;s usage report (exact token counts). The
        live meter is always close, but the settled amount is authoritative.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Why Crypto?
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Crypto-native billing gives you privacy (no email, no credit card),
        verifiability (every payment is on-chain with a tx hash), and global
        access (anyone with a wallet can use it). No KYC. No payment processor.
        Just pathUSD on Tempo.
      </p>

      <NavFooter currentId="pay-per-thought" onNavigate={onNavigate} />
    </div>
  );
}

function PricingSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">Pricing</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Meter charges per token with a 10% markup on OpenRouter base rates. A
        typical chat message costs fractions of a cent. Here are the current
        rates for popular models:
      </p>

      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Model
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Input
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Output
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                ~Per message
              </th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {[
              ["Claude Opus", "$5.50", "$27.50", "~$0.015"],
              ["GPT-5.2", "$1.93", "$15.40", "~$0.008"],
              ["Kimi K2", "$0.66", "$2.64", "~$0.002"],
              ["DeepSeek V3", "$0.33", "$0.97", "~$0.0006"],
              ["Gemini 3 Pro", "$2.20", "$13.20", "~$0.007"],
            ].map(([model, input, output, perMsg]) => (
              <tr
                key={model}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="px-4 py-2.5 font-mono text-foreground">
                  {model}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">
                  {input}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">
                  {output}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">
                  {perMsg}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground/50 mb-8">
        Prices per 1M tokens. Includes 10% Meter markup. &quot;Per message&quot;
        assumes ~500 token response.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        How to Read This
      </h2>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-6">
        <li>
          <strong className="text-foreground">Input</strong> — cost per 1M
          tokens you send (your messages + context)
        </li>
        <li>
          <strong className="text-foreground">Output</strong> — cost per 1M
          tokens the AI generates (its response)
        </li>
        <li>
          <strong className="text-foreground">Per message</strong> —
          approximate cost for a typical exchange (~200 input, ~500 output
          tokens)
        </li>
      </ul>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        At these rates, a $1.00 session cap gives you roughly 100-3,000 messages
        depending on the model.
      </p>

      <NavFooter currentId="pricing" onNavigate={onNavigate} />
    </div>
  );
}

function SessionKeysSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Session Keys
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Session keys solve the &quot;popup-per-message&quot; problem. Without
        them, every AI response would require a wallet signature — unusable for
        a real-time chat experience.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        How It Works
      </h2>
      <ol className="list-decimal list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-3 mb-8">
        <li>
          <strong className="text-foreground">Generate</strong> — when you click
          &quot;Authorize&quot;, Meter creates an ephemeral secp256k1 keypair in
          your browser&apos;s memory
        </li>
        <li>
          <strong className="text-foreground">Approve</strong> — your wallet
          signs ONE transaction: pathUSD.approve(sessionKey, cap). This allows
          the session key to spend up to your cap on your behalf
        </li>
        <li>
          <strong className="text-foreground">Fund</strong> — the session key is
          fauceted a tiny amount of native gas so it can send transactions
        </li>
        <li>
          <strong className="text-foreground">Settle</strong> — each message
          settlement is pathUSD.transferFrom(you, receiver, cost), signed by the
          session key locally. No wallet popup
        </li>
      </ol>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Security Properties
      </h2>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-6">
        <li>
          <strong className="text-foreground">Scoped</strong> — the session key
          can only spend pathUSD, only up to your approved cap
        </li>
        <li>
          <strong className="text-foreground">Ephemeral</strong> — the private
          key exists only in browser memory. It&apos;s destroyed when you close
          the tab
        </li>
        <li>
          <strong className="text-foreground">Revocable</strong> — click
          &quot;Revoke&quot; in the inspector to clear the key and reset the
          approval
        </li>
        <li>
          <strong className="text-foreground">Non-custodial</strong> — Meter
          never has access to your wallet or the session key
        </li>
      </ul>

      <NavFooter currentId="session-keys" onNavigate={onNavigate} />
    </div>
  );
}

function SettlementSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Settlement
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Settlement is the on-chain record of payment. After each AI response
        completes, the session key sends a transferFrom on pathUSD. The
        transaction hash is stored in the ledger and linked to the Tempo block
        explorer.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Per-Message Settlement
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Meter settles every message individually. When a response stream
        completes:
      </p>
      <ol className="list-decimal list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-8">
        <li>Server reports final token count</li>
        <li>
          Client calculates cost: (input × rate) + (output × rate)
        </li>
        <li>Session key calls transferFrom(user, receiver, cost)</li>
        <li>Tx hash is stored and shown in the chat inspector</li>
      </ol>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Gas Costs
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        On Tempo, a pathUSD transfer costs ~$0.001 in gas. Since the session key
        is pre-funded with native tokens, gas is invisible to the user.
      </p>

      <NavFooter currentId="settlement" onNavigate={onNavigate} />
    </div>
  );
}

function TempoNetworkSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Tempo Network
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
        Tempo is a high-throughput EVM-compatible blockchain designed for
        real-time settlement. Sub-second finality and low transaction fees make
        it ideal for micro-payment use cases like pay-per-thought AI.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Network Details
      </h2>
      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-6">
        <table className="w-full">
          <tbody className="text-[13px]">
            {[
              ["Chain Name", "Tempo Testnet (Moderato)"],
              ["Chain ID", "42431"],
              ["RPC", "https://rpc.moderato.tempo.xyz"],
              ["Explorer", "https://explore.tempo.xyz"],
              ["Native Currency", "USD (18 decimals)"],
              ["pathUSD", "0x20c0...0000 (6 decimals)"],
            ].map(([key, value]) => (
              <tr
                key={key}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="px-4 py-2.5 font-medium text-foreground w-40">
                  {key}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NavFooter currentId="tempo-network" onNavigate={onNavigate} />
    </div>
  );
}

function TIP20Section({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        TIP-20 Tokens
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        TIP-20 is Tempo&apos;s token standard (equivalent to ERC-20). Meter
        uses pathUSD, a USD-denominated stablecoin on Tempo, for all
        settlements. Costs are always in familiar dollar amounts.
      </p>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
        On testnet, the faucet automatically funds new wallets with test
        pathUSD. On mainnet, users fund their wallets with real stablecoins.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        pathUSD Contract
      </h2>
      <CodeBlock>{`Address:  0x20c0000000000000000000000000000000000000
Decimals: 6
Standard: ERC-20 / TIP-20
Methods:  balanceOf, transfer, approve, transferFrom, allowance`}</CodeBlock>

      <NavFooter currentId="tip-20-tokens" onNavigate={onNavigate} />
    </div>
  );
}

function PlatformSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">Platform</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
        Meter is also a developer platform. Integrate metered, crypto-settled AI
        into your own apps with a single API key. Same multi-model access, same
        real-time billing, same on-chain settlement — embedded in your product.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Why Build on Meter?
      </h2>
      <ul className="list-disc list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-8">
        <li>
          <strong className="text-foreground">Multi-model</strong> — access
          Claude, GPT-5.2, Gemini, DeepSeek, Kimi through one API
        </li>
        <li>
          <strong className="text-foreground">Pay-as-you-go</strong> — your
          users pay per token. No upfront commitments
        </li>
        <li>
          <strong className="text-foreground">On-chain receipts</strong> — every
          API call is settled on Tempo with a verifiable tx hash
        </li>
        <li>
          <strong className="text-foreground">2-minute integration</strong> —
          one API key, one endpoint, standard SSE streaming
        </li>
        <li>
          <strong className="text-foreground">No KYC</strong> — crypto-native.
          Connect wallet, get key, build
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Get Started
      </h2>
      <ol className="list-decimal list-outside ml-5 text-[15px] text-muted-foreground leading-relaxed space-y-2 mb-6">
        <li>
          Go to the{" "}
          <a
            href="https://dev.getmeter.xyz"
            className="text-foreground underline"
          >
            Developer Console
          </a>
        </li>
        <li>Connect your wallet</li>
        <li>Generate an API key</li>
        <li>Call the API or drop in the SDK</li>
      </ol>

      <NavFooter currentId="platform" onNavigate={onNavigate} />
    </div>
  );
}

function ApiReferenceSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        API Reference
      </h1>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        POST /api/v1/chat
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Stream an AI response. Authenticate with your API key in the
        Authorization header.
      </p>
      <CodeBlock>{`curl -N https://getmeter.xyz/api/v1/chat \\
  -H "Authorization: Bearer mk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "anthropic/claude-opus-4.6"
  }'`}</CodeBlock>

      <h3 className="text-base font-semibold text-foreground mt-8 mb-3">
        Request Body
      </h3>
      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Field
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            <tr className="border-b border-white/[0.04]">
              <td className="px-4 py-2.5 font-mono text-foreground">
                messages
              </td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">
                array
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                Chat messages array. Required.
              </td>
            </tr>
            <tr className="border-b border-white/[0.04]">
              <td className="px-4 py-2.5 font-mono text-foreground">model</td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">
                string
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                OpenRouter model ID. Default: anthropic/claude-opus-4.6
              </td>
            </tr>
            <tr className="border-b border-white/[0.04]">
              <td className="px-4 py-2.5 font-mono text-foreground">
                sessionCap
              </td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">
                number
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                Max USD spend for this session. Default: 1
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono text-foreground">
                sessionSpent
              </td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">
                number
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                USD already spent this session. Default: 0
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-base font-semibold text-foreground mt-8 mb-3">
        Response (SSE Stream)
      </h3>
      <CodeBlock>{`// Token chunks
data: {"type":"delta","content":"Hello","tokensOut":1}

// Final usage
data: {"type":"usage","tokensIn":15,"tokensOut":42}

// Stream end
data: {"type":"done"}`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-12 mb-4">
        Internal API (used by the chat UI)
      </h2>

      <h3 className="text-base font-semibold text-foreground mt-6 mb-3">
        POST /api/chat
      </h3>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Same SSE format as above, but no API key auth. Used by the Meter chat UI
        directly.
      </p>

      <h3 className="text-base font-semibold text-foreground mt-6 mb-3">
        POST /api/faucet
      </h3>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Fund a wallet with testnet pathUSD and native gas.
      </p>
      <CodeBlock>{`POST /api/faucet
Content-Type: application/json

{ "address": "0x..." }`}</CodeBlock>

      <NavFooter currentId="api-reference" onNavigate={onNavigate} />
    </div>
  );
}

function SdkSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">SDK</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Drop-in JavaScript/TypeScript SDK. Works in Node.js, browsers, and edge
        runtimes.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Install
      </h2>
      <CodeBlock>{`npm install @meterxyz/sdk`}</CodeBlock>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Or just copy the snippet below — it&apos;s a single fetch call.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Node.js / TypeScript
      </h2>
      <CodeBlock>{`const response = await fetch("https://getmeter.xyz/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer mk_your_api_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: "What is quantum computing?" }],
    model: "anthropic/claude-opus-4.6",
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split("\\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = JSON.parse(line.slice(6));
    
    if (data.type === "delta") {
      process.stdout.write(data.content);
    }
    if (data.type === "usage") {
      console.log("\\nTokens:", data.tokensIn, "in", data.tokensOut, "out");
    }
  }
}`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Python
      </h2>
      <CodeBlock>{`import requests

response = requests.post(
    "https://getmeter.xyz/api/v1/chat",
    headers={
        "Authorization": "Bearer mk_your_api_key",
        "Content-Type": "application/json",
    },
    json={
        "messages": [{"role": "user", "content": "Hello"}],
        "model": "anthropic/claude-opus-4.6",
    },
    stream=True,
)

for line in response.iter_lines():
    if line and line.startswith(b"data: "):
        import json
        data = json.loads(line[6:])
        if data["type"] == "delta":
            print(data["content"], end="", flush=True)`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">cURL</h2>
      <CodeBlock>{`curl -N https://getmeter.xyz/api/v1/chat \\
  -H "Authorization: Bearer mk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hi"}]}'`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Share with AI Coder
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Copy the prompt below and paste it into your AI coding assistant
        (Cursor, Copilot, etc.) to integrate Meter into your app:
      </p>
      <CodeBlock>{`Integrate Meter AI into this app. Use the following API:

POST https://getmeter.xyz/api/v1/chat
Authorization: Bearer mk_YOUR_KEY
Content-Type: application/json

Body: { "messages": [{"role":"user","content":"..."}], "model": "anthropic/claude-opus-4.6" }
Response: SSE stream with JSON lines:
  {"type":"delta","content":"...","tokensOut":N}
  {"type":"usage","tokensIn":N,"tokensOut":N}
  {"type":"done"}

It's a standard SSE endpoint. Parse "delta" events for streamed text.`}</CodeBlock>

      <NavFooter currentId="sdk" onNavigate={onNavigate} />
    </div>
  );
}

function ConfigurationSection({ onNavigate }: SectionProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground mb-6">
        Configuration
      </h1>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">
        Environment Variables
      </h2>
      <CodeBlock>{`# Required
OPENROUTER_API_KEY=                       # OpenRouter API key (sk-or-...)
NEXT_PUBLIC_PRIVY_APP_ID=                 # Privy app ID for wallet auth
NEXT_PUBLIC_PRIVY_CONSOLE_APP_ID=         # Privy app ID for dev console
NEXT_PUBLIC_SUPABASE_URL=                 # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=            # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=                # Supabase service role key`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Chain Configuration
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
        Meter uses Tempo Moderato (testnet) by default. Chain config is in{" "}
        <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">
          src/lib/tempo.ts
        </code>
        :
      </p>
      <CodeBlock>{`Chain ID:    42431
RPC:         https://rpc.moderato.tempo.xyz
pathUSD:     0x20c0000000000000000000000000000000000000
Explorer:    https://explore.tempo.xyz`}</CodeBlock>

      <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
        Pricing
      </h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
        Token rates are configured per model in{" "}
        <code className="text-foreground bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">
          src/lib/models.ts
        </code>
        . Prices include a 10% Meter markup on OpenRouter base rates.
      </p>

      <NavFooter currentId="configuration" onNavigate={onNavigate} />
    </div>
  );
}
