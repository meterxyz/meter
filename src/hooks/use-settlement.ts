"use client";

import { useCallback } from "react";
import { useWallets, useSendTransaction } from "@privy-io/react-auth";
import { SETTLEMENT_RECEIVER, dollarToWei } from "@/lib/tempo";
import { numberToHex } from "viem";

export function useSettlement() {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const settle = useCallback(
    async (amountUsd: number): Promise<string> => {
      const value = dollarToWei(amountUsd);

      try {
        const receipt = await sendTransaction(
          {
            to: SETTLEMENT_RECEIVER,
            value: numberToHex(value),
          },
          {
            uiOptions: {
              showWalletUIs: false,
            },
          }
        );
        return receipt.hash;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("insufficient") ||
          msg.toLowerCase().includes("fund") ||
          msg.toLowerCase().includes("failed to fetch")
        ) {
          throw new Error("Settlement failed — network or funds issue");
        }
        throw err;
      }
    },
    [sendTransaction]
  );

  const getAddress = useCallback((): string | null => {
    const wallet = wallets.find((w) => w.walletClientType === "privy");
    return wallet?.address ?? null;
  }, [wallets]);

  return { settle, getAddress };
}
