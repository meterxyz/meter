"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMeterStore } from "@/lib/store";
import { ChatView } from "@/components/chat-view";
import { LoginScreen } from "@/components/login-screen";
import { AuthorizeScreen } from "@/components/authorize-screen";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authenticated = useMeterStore((s) => s.authenticated);
  const cardOnFile = useMeterStore((s) => s.cardOnFile);
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

  // Flow: Passkey → Card → Chat
  if (!authenticated) {
    return <LoginScreen />;
  }

  if (!cardOnFile) {
    return <AuthorizeScreen />;
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
