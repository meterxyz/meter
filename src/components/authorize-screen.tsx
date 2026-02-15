"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, encodeFunctionData, formatUnits } from "viem";
import { useMeterStore } from "@/lib/store";
import {
  tempoModerato,
  PATHUSD_ADDRESS,
  PATHUSD_DECIMALS,
  TIP20_ABI,
  dollarToUnits,
} from "@/lib/tempo";
import Image from "next/image";

export function AuthorizeScreen() {
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const { maxSpend, setMaxSpend, setSessionKey, setAuthorized, addEvent } =
    useMeterStore();

  const [capInput, setCapInput] = useState(maxSpend.toString());
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const connectedWallet =
    wallets.find((w) => w.walletClientType !== "privy") ?? wallets[0];
  const walletAddress = connectedWallet?.address;

  const cap = parseFloat(capInput) || 1.0;
  const lowBalance = balance !== null && balance < cap;

  // Fetch pathUSD balance
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setBalanceLoading(true);
    try {
      const client = createPublicClient({ chain: tempoModerato, transport: http() });
      const raw = await client.readContract({
        address: PATHUSD_ADDRESS,
        abi: TIP20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      });
      setBalance(Number(formatUnits(raw as bigint, PATHUSD_DECIMALS)));
    } catch {
      setBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleAuthorize = async () => {
    if (!connectedWallet || !walletAddress) return;
    setLoading(true);

    try {
      // 1. Generate ephemeral session key
      const privKey = generatePrivateKey();
      const account = privateKeyToAccount(privKey);
      const sessionKeyAddr = account.address;

      setStatus("Requesting approval in wallet (one signature)...");

      // 2. Ensure Tempo network is added to wallet
      const provider = await connectedWallet.getEthereumProvider();
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${tempoModerato.id.toString(16)}`,
            chainName: tempoModerato.name,
            nativeCurrency: tempoModerato.nativeCurrency,
            rpcUrls: [tempoModerato.rpcUrls.default.http[0]],
            blockExplorerUrls: [tempoModerato.blockExplorers.default.url],
          }],
        });
      } catch {
        /* already added */
      }

      // 3. If balance is low or zero, faucet FIRST (fresh wallets need gas + tokens)
      if (lowBalance || balance === 0) {
        setStatus("Adding testnet tokens...");
        try {
          await fetch("/api/faucet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: walletAddress }),
          });
          addEvent("tick", "Testnet tokens added via faucet");
          // Brief pause for RPC to reflect the faucet deposit
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          // Non-blocking — continue and hope balance is sufficient
        }
      }

        // 4. Transfer pathUSD to session key (one wallet popup)
        // Session key holds its own balance and pays directly — no transferFrom needed
        setStatus("Requesting approval in wallet...");
        const fundAmount = dollarToUnits(cap);
        const transferData = encodeFunctionData({
          abi: TIP20_ABI,
          functionName: "transfer",
          args: [sessionKeyAddr, fundAmount],
        });

        await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: PATHUSD_ADDRESS,
            data: transferData,
            chainId: `0x${tempoModerato.id.toString(16)}`,
          }],
        });

        // 5. Finalize
      setMaxSpend(cap);
      setSessionKey(privKey, sessionKeyAddr);
      setAuthorized(true);
      addEvent(
        "tick",
        `Session authorized: $${cap.toFixed(2)} cap | key: ${sessionKeyAddr.slice(0, 10)}...`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
      addEvent("settlement_fail", `Authorize failed: ${msg}`);
      setLoading(false);
    }
  };

  const maxPerMessage = "~$0.03";
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "connecting...";

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo-dark-copy.webp"
            alt="Meter"
            width={72}
            height={20}
          />
          <h1 className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
            Authorize Session
          </h1>
        </div>

        {/* Card */}
        <div className="w-full rounded-xl border border-border bg-card p-5 flex flex-col gap-0">
          {/* Wallet Balance */}
          <div className="flex items-center justify-between py-3">
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              Wallet Balance
            </span>
            <span className="font-mono text-sm text-foreground">
              {balanceLoading ? "..." : `$${balance?.toFixed(2) ?? "0.00"}`}
            </span>
          </div>

          <div className="h-px bg-border" />

          {/* Session Cap */}
          <div className="flex items-center justify-between py-3">
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              Session Cap
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm text-foreground">$</span>
              <input
                type="number"
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                step={0.1}
                min={0.1}
                className="w-14 bg-transparent font-mono text-sm text-foreground text-right focus:outline-none py-0.5"
              />
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Max Per Message */}
          <div className="flex items-center justify-between py-3">
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
              Max Per Message
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              {maxPerMessage}
            </span>
          </div>
        </div>

        {/* Warning if low balance */}
        {!balanceLoading && lowBalance && (
          <p className="font-mono text-[11px] text-yellow-500 text-center">
            Balance below cap — testnet tokens will be added automatically
          </p>
        )}

        {/* Status message */}
        {status && (
          <p className="font-mono text-[11px] text-muted-foreground/60 text-center">
            {status}
          </p>
        )}

        {/* Authorize Button */}
        <button
          onClick={handleAuthorize}
          disabled={loading}
          className="w-full rounded-xl bg-foreground py-3.5 font-mono text-sm text-background transition-colors hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading
            ? "Authorizing..."
            : `Authorize streaming up to $${cap.toFixed(2)} for this session`}
        </button>

        {/* Disclaimer */}
        <p className="font-mono text-[10px] text-muted-foreground/50 text-center leading-relaxed max-w-xs">
          This transfers up to ${cap.toFixed(2)} pathUSD to a session key.
            No further wallet popups after this.
        </p>

        {/* Connected wallet + disconnect */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {shortAddr}
          </span>
          <button
            onClick={logout}
            className="text-muted-foreground/40 hover:text-foreground transition-colors ml-1"
            title="Disconnect"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
