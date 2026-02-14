import { defineChain, parseEther } from "viem";

// Tempo Moderato Testnet (chain ID 42431)
// Native currency is USD — gas is paid in stablecoins, not a separate gas token
export const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Testnet (Moderato)",
  nativeCurrency: {
    name: "USD",
    symbol: "USD",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.moderato.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: "https://explore.tempo.xyz",
    },
  },
  testnet: true,
});

// Service wallet that receives settlement payments
// In production this would be your treasury / operator address
export const SETTLEMENT_RECEIVER = "0x000000000000000000000000000000000000dEaD" as const;

// Convert dollar amount to native USD wei (18 decimals)
export function dollarToWei(amount: number): bigint {
  // Native USD has 18 decimals like ETH
  return parseEther(amount.toFixed(18));
}

// Explorer link for a transaction hash
export function txExplorerUrl(txHash: string): string {
  return `https://explore.tempo.xyz/tx/${txHash}`;
}

// Format a settlement memo
export function formatMemo(sessionId: string, msgIndex: number): string {
  return `meter:${sessionId}:${msgIndex}`;
}
