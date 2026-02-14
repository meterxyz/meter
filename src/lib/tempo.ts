import { defineChain, parseUnits } from "viem";

// Tempo Moderato Testnet (chain ID 42431)
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

// pathUSD TIP20 token — 6 decimals (like USDC)
export const PATHUSD_ADDRESS = "0x20c0000000000000000000000000000000000000" as const;
export const PATHUSD_DECIMALS = 6;

// Minimal TIP20/ERC20 ABI for balanceOf, transfer, transferFrom, approve, transferWithMemo
export const TIP20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transferWithMemo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Service wallet that receives settlement payments
export const SETTLEMENT_RECEIVER = "0x000000000000000000000000000000000000dEaD" as const;

// Convert dollar amount to pathUSD units (6 decimals)
export function dollarToUnits(amount: number): bigint {
  return parseUnits(amount.toFixed(6), PATHUSD_DECIMALS);
}

// Format pathUSD units back to dollar string
export function unitsToDollar(units: bigint): string {
  const num = Number(units) / 1e6;
  return num.toFixed(2);
}

// Explorer link for a transaction hash
export function txExplorerUrl(txHash: string): string {
  return `https://explore.tempo.xyz/tx/${txHash}`;
}

// Format a settlement memo as bytes32
export function formatMemo(sessionId: string, msgIndex: number): string {
  const text = `meter:${sessionId}:${msgIndex}`;
  // Pad to 32 bytes
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(32);
  bytes.set(encoded.slice(0, 32));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
