# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Meter, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email **security@getmeter.xyz** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Scope

The following are in scope:

- Smart contract interactions (pathUSD transfers, session key approvals)
- Session key generation and management
- API authentication (API key validation, rate limiting)
- Wallet connection and authorization flow
- Server-side API routes (`/api/chat`, `/api/faucet`, `/api/v1/*`)

## Architecture Security Notes

- **Non-custodial** — Meter never holds user private keys or seed phrases
- **Session keys** — Ephemeral keypairs generated in-browser, stored only in memory, destroyed on tab close
- **Scoped approvals** — Session keys can only spend pathUSD up to the user-defined cap
- **No PII** — No email, password, or personal data collected. Wallet address only
- **Server-side secrets** — API keys and service role keys are never exposed to the client

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `main` | Yes |
| Older commits | No |

## Disclosure Policy

- We follow coordinated disclosure
- We will credit reporters in the changelog (unless anonymity is requested)
- We aim to patch critical vulnerabilities within 72 hours of confirmation
