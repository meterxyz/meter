"use client";

import { useCallback, useRef } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { tempoModerato, SETTLEMENT_RECEIVER, dollarToWei } from "@/lib/tempo";

export function useSettlement() {
  const { wallets } = useWallets();
  const switchedRef = useRef(false);

  const getWalletClient = useCallback(async () => {
    const wallet = wallets.find((w) => w.walletClientType === "privy");
    if (!wallet) throw new Error("No embedded wallet found");

    // Switch chain once per session
    if (!switchedRef.current) {
      await wallet.switchChain(tempoModerato.id);
      switchedRef.current = true;
    }

    const provider = await wallet.getEthereumProvider();
    return createWalletClient({
      chain: tempoModerato,
      transport: custom(provider),
      account: wallet.address as `0x${string}`,
    });
  }, [wallets]);

    const settle = useCallback(
      async (amountUsd: number): Promise<string> => {
        const client = await getWalletClient();
        const value = dollarToWei(amountUsd);

        try {
          const hash = await client.sendTransaction({
            to: SETTLEMENT_RECEIVER,
            value,
          });
          return hash;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // Re-throw with a clean message instead of letting Privy handle it
          if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("fund")) {
            throw new Error("Insufficient testnet funds — request more from faucet");
          }
          throw err;
        }
      },
      [getWalletClient]
    );

  const getAddress = useCallback((): string | null => {
    const wallet = wallets.find((w) => w.walletClientType === "privy");
    return wallet?.address ?? null;
  }, [wallets]);

  return { settle, getAddress };
}
