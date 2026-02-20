"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMeterStore } from "@/lib/store";
import { ChatView } from "@/components/chat-view";
import { LoginScreen } from "@/components/login-screen";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authenticated = useMeterStore((s) => s.authenticated);
  const connectService = useMeterStore((s) => s.connectService);
  const fetchConnectionStatus = useMeterStore((s) => s.fetchConnectionStatus);

  // Handle OAuth callback redirect (still needed for Connections page)
  useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    const provider = searchParams.get("provider");
    if (oauthResult === "success" && provider) {
      connectService(provider);
      fetchConnectionStatus();
      router.replace("/");
    }
  }, [searchParams, connectService, fetchConnectionStatus, router]);

  // Sync connection status from server on mount
  useEffect(() => {
    if (authenticated) {
      fetchConnectionStatus();
    }
  }, [authenticated, fetchConnectionStatus]);

  // Flow: Passkey → Chat (card is requested via AI intro message)
  if (!authenticated) {
    return <LoginScreen />;
  }

  return <ChatView />;
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
