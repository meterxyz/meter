"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { tempoModerato } from "@/lib/tempo";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["passkey"],
        appearance: {
          theme: "dark",
          accentColor: "#e5e5e5",
          logo: undefined,
        },
        defaultChain: tempoModerato,
        supportedChains: [tempoModerato],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
