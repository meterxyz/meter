"use client";

import { useCallback } from "react";
import { createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  tempoModerato,
  SETTLEMENT_RECEIVER,
  PATHUSD_ADDRESS,
  TIP20_ABI,
  dollarToUnits,
  formatMemo,
} from "@/lib/tempo";
import { useMeterStore } from "@/lib/store";

/**
 * Settlement hook using ephemeral session key.
 * Session key holds its own pathUSD balance (funded during authorize).
 * Uses TIP20 transfer(receiver, amount) — ZERO wallet popups during chat.
 */
export function useSettlement() {
  const sessionKeyPrivate = useMeterStore((s) => s.sessionKeyPrivate);
  const sessionKeyAddress = useMeterStore((s) => s.sessionKeyAddress);

  const settle = useCallback(
    async (amountUsd: number, _ownerAddress: string, msgIndex?: number): Promise<string> => {
      if (!sessionKeyPrivate) {
        throw new Error("No session key — authorize first");
      }

      const account = privateKeyToAccount(sessionKeyPrivate as `0x${string}`);
      const client = createWalletClient({
        chain: tempoModerato,
        transport: http(),
        account,
      });

      const amount = dollarToUnits(amountUsd);
      const memo = formatMemo("session", msgIndex ?? 0) as `0x${string}`;

      try {
        // Use transferWithMemo: session key transfers from its own balance
        const data = encodeFunctionData({
          abi: TIP20_ABI,
          functionName: "transferWithMemo",
          args: [SETTLEMENT_RECEIVER, amount, memo],
        });

        const hash = await client.sendTransaction({
          to: PATHUSD_ADDRESS,
          data,
          value: BigInt(0),
        });

        return hash;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("insufficient") ||
          msg.toLowerCase().includes("fund")
        ) {
          throw new Error(
            "Insufficient session key balance — top up tokens or start a new session"
          );
        }
        throw err;
      }
    },
    [sessionKeyPrivate]
  );

  const getAddress = useCallback((): string | null => {
    return sessionKeyAddress;
  }, [sessionKeyAddress]);

  return { settle, getAddress };
}
