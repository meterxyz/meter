"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null);
  const [isConsole, setIsConsole] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const console =
      hostname === "dev.getmeter.xyz" ||
      hostname === "getmeter.dev" ||
      hostname.startsWith("dev.");
    setIsConsole(console);
    setAppId(
      console
        ? process.env.NEXT_PUBLIC_PRIVY_CONSOLE_APP_ID!
        : process.env.NEXT_PUBLIC_PRIVY_APP_ID!
    );
  }, []);

  if (!appId) return null;

  // Console gets a simple wallet-only Privy config
  if (isConsole) {
    return (
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["wallet"],
          appearance: {
            theme: "dark",
            accentColor: "#e5e5e5",
            logo: undefined,
          },
        }}
      >
        {children}
      </PrivyProvider>
    );
  }

      // Main app gets wallet-only config (EVM only, no custom chain at login)
    return (
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["wallet"],
          appearance: {
            theme: "dark",
            accentColor: "#e5e5e5",
            logo: undefined,
            walletList: ["metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
          },
        }}
      >
        {children}
      </PrivyProvider>
    );
}
