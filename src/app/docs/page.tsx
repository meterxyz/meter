"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const sections = [
  {
    title: "Get Started",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "how-it-works", label: "How It Works" },
      { id: "quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { id: "pay-per-thought", label: "Pay Per Thought" },
      { id: "real-time-metering", label: "Real-Time Metering" },
      { id: "settlement", label: "Settlement" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { id: "embedded-wallets", label: "Embedded Wallets" },
      { id: "tempo-network", label: "Tempo Network" },
      { id: "tip-20-tokens", label: "TIP-20 Tokens" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "api", label: "API" },
      { id: "configuration", label: "Configuration" },
    ],
  },
];

const content: Record<string, { title: string; body: React.ReactNode }> = {
  introduction: {
    title: "Introduction",
    body: (
      <>
        <p>
          Meter is a pay-per-thought AI chat interface that meters every token in real time
          and settles payments on-chain via the Tempo network. No subscriptions, no credits —
          you pay only for what you use, at the exact moment you use it.
        </p>
        <h2 id="why-meter">Why Meter?</h2>
        <p>
          Traditional AI billing is opaque. You buy credits in bulk, consume them invisibly, and
          have no idea what any single interaction cost. Meter flips this: a live cost ticker runs
          as the AI responds, and each message is settled as a blockchain transaction you can verify
          on-chain.
        </p>
        <h2 id="key-features">Key Features</h2>
        <ul>
          <li><strong>Real-time cost metering</strong> — watch your spend tick up token by token as the AI streams its response</li>
          <li><strong>On-chain settlement</strong> — every response is settled as a TIP-20 transfer on Tempo, with a clickable transaction hash</li>
          <li><strong>Embedded wallets</strong> — no MetaMask, no seed phrases. Passkey-based auth creates a wallet automatically</li>
          <li><strong>Transparent pricing</strong> — cost per token is visible, verifiable, and consistent</li>
        </ul>
      </>
    ),
  },
  "how-it-works": {
    title: "How It Works",
    body: (
      <>
        <p>Meter connects three systems:</p>
        <ol>
          <li><strong>OpenAI streaming API</strong> — generates AI responses and reports token usage</li>
          <li><strong>Privy embedded wallets</strong> — creates a non-custodial wallet per user via passkey authentication</li>
          <li><strong>Tempo network</strong> — a high-throughput EVM chain where settlements are recorded as TIP-20 transfers</li>
        </ol>
        <h2 id="flow">Flow</h2>
        <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm leading-relaxed">
          <p className="text-muted-foreground">1. User sends a message</p>
          <p className="text-muted-foreground">2. Server streams AI response via SSE</p>
          <p className="text-muted-foreground">3. Client counts tokens and updates cost in real time</p>
          <p className="text-muted-foreground">4. On stream completion, client calls sendTransaction</p>
          <p className="text-muted-foreground">5. Settlement is recorded on Tempo with a tx hash</p>
          <p className="text-muted-foreground">6. Tx hash appears in the ledger, linked to explorer</p>
        </div>
      </>
    ),
  },
  quickstart: {
    title: "Quickstart",
    body: (
      <>
        <p>Get Meter running locally in under a minute.</p>
        <h2 id="prerequisites">Prerequisites</h2>
        <ul>
          <li>Node.js 18+ or Bun</li>
          <li>A Privy app ID (free at <a href="https://dashboard.privy.io" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-foreground/80">dashboard.privy.io</a>)</li>
          <li>An OpenAI API key</li>
        </ul>
        <h2 id="install">Install</h2>
        <pre><code>{`git clone https://github.com/nicholaswinton2/meter-chat
cd meter-chat
cp .env.example .env.local
# Add your NEXT_PUBLIC_PRIVY_APP_ID and OPENAI_API_KEY
bun install
bun dev`}</code></pre>
        <p>
          Open <code>http://localhost:3000</code>, create a passkey, and start chatting. Your wallet
          is funded automatically from the testnet faucet.
        </p>
      </>
    ),
  },
  "pay-per-thought": {
    title: "Pay Per Thought",
    body: (
      <>
        <p>
          Pay-per-thought is the billing model: you pay for each AI response proportional to its
          length, at the exact moment it&apos;s generated. There are no subscriptions, no prepaid
          credits, and no monthly invoices.
        </p>
        <h2 id="pricing">Pricing</h2>
        <p>
          Cost is calculated from OpenAI&apos;s token usage report at the end of each streamed
          response. The formula is simple:
        </p>
        <pre><code>{`cost = (input_tokens × input_rate) + (output_tokens × output_rate)`}</code></pre>
        <p>
          Rates are set per model. For GPT-4o-mini, input is $0.15/1M tokens and output is
          $0.60/1M tokens. A typical response costs fractions of a cent.
        </p>
      </>
    ),
  },
  "real-time-metering": {
    title: "Real-Time Metering",
    body: (
      <>
        <p>
          As the AI streams its response, the client counts tokens in real time and displays
          a live cost estimate in the inspector panel. This is an off-chain approximation that
          updates every chunk.
        </p>
        <p>
          The final cost is determined by the server&apos;s usage report, which includes the
          exact token counts. The live meter is always close but the settled amount is
          authoritative.
        </p>
      </>
    ),
  },
  settlement: {
    title: "Settlement",
    body: (
      <>
        <p>
          Settlement is the on-chain record of payment. After each AI response completes, the
          client sends a TIP-20 token transfer on the Tempo network. The transaction hash is
          stored in the ledger and linked to the Tempo block explorer.
        </p>
        <h2 id="batching">Batching Strategy</h2>
        <p>
          Currently, Meter settles per-message (one transaction per AI response). For production,
          a batched strategy — settling once per session or on a timer — reduces gas costs while
          maintaining the live metering experience.
        </p>
        <p>
          At Tempo&apos;s fee structure (~$0.001 per transfer), a 0.5% take rate breaks even
          at ~$0.20 per session with end-of-session settlement.
        </p>
      </>
    ),
  },
  "embedded-wallets": {
    title: "Embedded Wallets",
    body: (
      <>
        <p>
          Meter uses Privy embedded wallets so users never need to install a browser extension
          or manage seed phrases. A wallet is created automatically when the user signs up
          with a passkey.
        </p>
        <p>
          The wallet is non-custodial — Privy uses MPC (multi-party computation) to split the
          key, so neither Meter nor Privy has full access to the user&apos;s funds.
        </p>
      </>
    ),
  },
  "tempo-network": {
    title: "Tempo Network",
    body: (
      <>
        <p>
          Tempo is a high-throughput EVM-compatible blockchain designed for real-time settlement.
          It provides sub-second finality and low transaction fees, making it ideal for
          micro-payment use cases like pay-per-thought AI.
        </p>
        <p>
          Meter uses the Tempo Moderato testnet (chain ID 11155421) for development. Settlements
          are viewable on the <a href="https://explore.tempo.xyz" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-foreground/80">Tempo Explorer</a>.
        </p>
      </>
    ),
  },
  "tip-20-tokens": {
    title: "TIP-20 Tokens",
    body: (
      <>
        <p>
          TIP-20 is Tempo&apos;s token standard (equivalent to ERC-20 on Ethereum). Meter uses
          a TIP-20 USD stablecoin for settlements, so costs are denominated in familiar dollar
          amounts.
        </p>
        <p>
          On testnet, the faucet automatically funds new wallets with test USD tokens. On mainnet,
          users would fund their wallets with real stablecoins.
        </p>
      </>
    ),
  },
  api: {
    title: "API",
    body: (
      <>
        <h2 id="chat-endpoint">POST /api/chat</h2>
        <p>Streams an AI response using server-sent events (SSE).</p>
        <pre><code>{`// Request
POST /api/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}

// Response (SSE stream)
data: {"choices":[{"delta":{"content":"Hi"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
data: [DONE]`}</code></pre>
        <h2 id="faucet-endpoint">POST /api/faucet</h2>
        <p>Funds an embedded wallet with testnet USD tokens.</p>
        <pre><code>{`POST /api/faucet
Content-Type: application/json

{ "address": "0x..." }`}</code></pre>
      </>
    ),
  },
  configuration: {
    title: "Configuration",
    body: (
      <>
        <h2 id="env-vars">Environment Variables</h2>
        <pre><code>{`# Required
NEXT_PUBLIC_PRIVY_APP_ID=   # Your Privy app ID
OPENAI_API_KEY=              # OpenAI API key

# Optional
NEXT_PUBLIC_TEMPO_RPC=       # Custom Tempo RPC endpoint
NEXT_PUBLIC_TAKE_RATE=       # Platform take rate (default: 0.005)`}</code></pre>
      </>
    ),
  },
};

export default function DocsPage() {
  const [activeId, setActiveId] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const active = content[activeId];

  const navigateTo = (id: string) => {
    setActiveId(id);
    document.getElementById("docs-main")?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden rounded-md border border-border bg-background p-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-40 h-full w-64 shrink-0 border-r border-border bg-background overflow-y-auto transition-transform md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-border">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Image
                src="/logo-dark-copy.webp"
                alt="Meter"
                width={72}
                height={19}
                priority
                className="translate-y-[1px]"
              />
              <span className="font-mono text-xs text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors leading-none">
                docs
              </span>
            </Link>
        </div>

        <nav className="p-4 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/50 mb-2 px-2">
                {section.title}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                        onClick={() => {
                          navigateTo(item.id);
                          setSidebarOpen(false);
                        }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                        activeId === item.id
                          ? "text-foreground bg-foreground/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 mt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <a
              href="https://x.com/tempodotxyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
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
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
    <main id="docs-main" className="flex-1 overflow-y-auto">
          <div className="max-w-2xl px-6 md:px-8 py-12 md:py-16">
          <article className="docs-content">
            <h1 className="text-3xl font-semibold tracking-tight mb-8">{active.title}</h1>
            <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_pre]:bg-card [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:font-mono [&_pre]:text-foreground [&_code]:font-mono [&_code]:text-sm [&_strong]:text-foreground [&_strong]:font-medium">
              {active.body}
            </div>
          </article>

          {/* Prev/Next navigation */}
          <div className="mt-16 pt-6 border-t border-border flex justify-between">
            {(() => {
              const allItems = sections.flatMap((s) => s.items);
              const idx = allItems.findIndex((i) => i.id === activeId);
              const prev = idx > 0 ? allItems[idx - 1] : null;
              const next = idx < allItems.length - 1 ? allItems[idx + 1] : null;
              return (
                <>
                  {prev ? (
                      <button
                        onClick={() => navigateTo(prev.id)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        &larr; {prev.label}
                      </button>
                    ) : (
                      <span />
                    )}
                    {next ? (
                      <button
                        onClick={() => navigateTo(next.id)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {next.label} &rarr;
                    </button>
                  ) : (
                    <span />
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
