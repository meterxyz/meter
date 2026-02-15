<p align="center">
  <img src="public/logo-dark-copy.webp" alt="Meter" width="140" />
</p>

<h3 align="center">Pay Per Thought</h3>

<p align="center">
  Real-time metered AI. Every token counted, every cent settled on-chain.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tempo.xyz"><img src="https://img.shields.io/badge/Tempo-Testnet-purple" alt="Tempo" /></a>
  <a href="https://canteenapp-tempo.notion.site"><img src="https://img.shields.io/badge/Tempo%20Hackathon-2026-orange" alt="Tempo Hackathon" /></a>
</p>

<p align="center">
  <a href="https://getmeter.xyz">Live Demo</a> &nbsp;&middot;&nbsp;
  <a href="https://getmeter.xyz/docs">Documentation</a> &nbsp;&middot;&nbsp;
  <a href="https://x.com/meterxyz">Twitter</a>
</p>

---

## What is Meter?

Meter is a **pay-per-thought AI interface** that meters every token in real time and settles payments on-chain via the [Tempo network](https://tempo.xyz). No subscriptions, no credits, no invoices — you pay only for what you use, streamed in real time.

A live cost ticker runs as the AI responds. Each message is settled as a blockchain transaction you can verify on-chain. One wallet signature authorizes the entire session — zero popups after that.

## How It Works

```
┌────────────-─┐     ┌─────────────┐     ┌───────────-──┐
│   Browser    │     │   Server    │     │   Tempo      │
│              │     │             │     │   Network    │
│  Connect     │────▶│             │     │              │
│  Wallet      │     │             │     │              │
│              │     │             │     │              │
│  Authorize   │─tx─▶│             │     │  transfer()  │
│  Session     │     │             │     │  pathUSD     │
│              │     │             │     │              │
│  Send        │────▶│  Stream AI  │     │              │
│  Message     │◀─sse│ (OpenRouter)│     │              │
│              │     │             │     │              │
│  Meter       │     │  Report     │     │              │
│  ticks...    │◀────│  usage      │     │              │
│              │     │             │     │              │
│  Session key │─tx─▶│             │────▶│  Settle      │
│  settles     │     │             │     │  on-chain    │
└─────────-────┘     └─────────────┘     └────────-─────┘
```

1. **Connect** — User connects wallet via Privy (MetaMask, WalletConnect, etc.)
2. **Authorize** — One wallet signature transfers pathUSD to an ephemeral session key
3. **Chat** — Messages stream via SSE; the meter ticks in real time
4. **Settle** — Session key calls `transfer()` on pathUSD — no popup, no confirmation
5. **Verify** — Every settlement has a tx hash linked to the Tempo block explorer

## Features

- **Real-time cost metering** — Watch your spend tick up token by token as the AI streams
- **On-chain settlement** — Every response settled as a pathUSD transfer on Tempo with a verifiable tx hash
- **Session keys** — One wallet signature authorizes the session. Zero popups after that
- **Multi-model** — Claude, GPT-4o, Gemini, DeepSeek, Kimi and more via OpenRouter
- **Developer Console** — Generate API keys, monitor usage, manage billing
- **Developer API** — Integrate metered AI into your own apps with a single API key
- **Non-custodial** — Your wallet, your keys. Meter never has access to your funds
- **Privacy-first** — No email, no account, no KYC. Connect wallet and chat

## Design Decisions

- Tempo for settlement. Sub-second finality, ~$0.001 gas, native USD denomination. The only chain where per-message AI billing is economically viable.
- pathUSD as currency. 6-decimal stablecoin (same as USDC). Users think in dollars, settle in dollars. No price feeds, no volatility, no conversion.
- Ephemeral session keys. One wallet signature authorizes the session. Every payment after that is signed locally in browser memory. Zero popups. Key destroyed on tab close.
- Per-message settlement. Every response is settled individually with a verifiable tx hash. No batching, no reconciliation. Transparency is the product.
- OpenRouter for models. One integration, every frontier model. Published per-token pricing with a small Meter markup.
- Private by default. No email, no account, no KYC. Connect wallet, chat fully encrypted. Your address is your identity.
- Fully open source (MIT). Non-custodial system requires auditable code. Users can verify, fork, or self-host.

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Main chat interface
│   ├── console/page.tsx          # Developer console (API keys, usage)
│   ├── docs/page.tsx             # Documentation
│   └── api/
│       ├── chat/route.ts         # SSE streaming via OpenRouter
│       ├── faucet/route.ts       # Testnet pathUSD faucet
│       └── v1/
│           ├── keys/route.ts     # API key management
│           └── usage/route.ts    # Usage tracking
├── components/
│   ├── authorize-screen.tsx      # Session authorization flow
│   ├── chat-view.tsx             # Chat UI with settlement receipts
│   ├── inspector.tsx             # Dev inspector (wallet, telemetry, ledger)
│   ├── meter-pill.tsx            # Live cost ticker component
│   ├── meter-icon.tsx            # Animated meter icon (sprite sheet)
│   └── login-screen.tsx          # Wallet connection screen
├── hooks/
│   └── use-settlement.ts         # On-chain settlement via session key
└── lib/
    ├── store.ts                  # Zustand state (session, messages, ledger)
    └── tempo.ts                  # Tempo chain config, pathUSD ABI, helpers
```

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org) (App Router, Turbopack) |
| Language | [TypeScript 5](https://typescriptlang.org) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Wallet Auth | [Privy](https://privy.io) |
| Blockchain | [Tempo Network](https://tempo.xyz) via [viem](https://viem.sh) |
| AI Models | [OpenRouter](https://openrouter.ai) (Claude, GPT-4o, Gemini, DeepSeek, Kimi) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| UI | [Radix UI](https://radix-ui.com) + [shadcn/ui](https://ui.shadcn.com) |

## Quick Start

### Prerequisites

- Node.js 18+ or [Bun](https://bun.sh)
- MetaMask or any EVM wallet
- [OpenRouter API key](https://openrouter.ai/keys)
- [Privy app ID](https://dashboard.privy.io)
- [Supabase project](https://supabase.com)

### Install

```bash
git clone https://github.com/meterxyz/meter.git
cd meter
cp .env.example .env.local
bun install
bun dev
```

### Environment Variables

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-...             # OpenRouter API key
NEXT_PUBLIC_PRIVY_APP_ID=cm...          # Privy app ID (chat)
NEXT_PUBLIC_PRIVY_CONSOLE_APP_ID=cm...  # Privy app ID (dev console)
NEXT_PUBLIC_SUPABASE_URL=https://...    # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=ey...         # Supabase service role key
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, authorize a session, and start chatting. Testnet pathUSD is fauceted automatically.

## API

Meter exposes a developer API for integrating metered AI into any application.

### `POST /api/v1/chat`

Stream an AI response with real-time token metering.

```bash
curl -N https://getmeter.xyz/api/v1/chat \
  -H "Authorization: Bearer mk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "openai/gpt-4o"
  }'
```

**Response** (Server-Sent Events):

```
data: {"type":"delta","content":"Hello","tokensOut":1}
data: {"type":"usage","tokensIn":15,"tokensOut":42}
data: {"type":"done"}
```

### `POST /api/faucet`

Fund a wallet with testnet pathUSD.

```bash
curl https://getmeter.xyz/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

## Tempo Network

Meter settles on [Tempo](https://tempo.xyz), a high-throughput EVM chain with sub-second finality.

| Property | Value |
|----------|-------|
| Chain Name | Tempo Testnet (Moderato) |
| Chain ID | `42431` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Explorer | [explore.tempo.xyz](https://explore.tempo.xyz) |
| Settlement Token | pathUSD (`0x20c0...0000`, 6 decimals) |

## Pricing

Pay-per-token with a small markup on OpenRouter base rates. A typical message costs fractions of a cent.

| Model | Input (per 1M) | Output (per 1M) | ~Per Message |
|-------|----------------|-----------------|-------------|
| Claude Sonnet | $3.30 | $16.50 | ~$0.009 |
| GPT-4o | $2.75 | $11.00 | ~$0.006 |
| Kimi K2 | $0.66 | $2.64 | ~$0.002 |
| DeepSeek V3 | $0.33 | $0.97 | ~$0.0006 |
| Gemini Flash | $0.17 | $0.66 | ~$0.0004 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and responsible disclosure process.

## License

MIT. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built for the <a href="https://canteenapp-tempo.notion.site">Tempo Hackathon</a>
</p>
