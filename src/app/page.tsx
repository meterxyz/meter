"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMeterStore } from "@/lib/store";
import { ChatView } from "@/components/chat-view";
import { LoginScreen } from "@/components/login-screen";
import { AuthorizeScreen } from "@/components/authorize-screen";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const authorized = useMeterStore((s) => s.authorized);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <img src="/meter-spin.gif" alt="Loading" className="w-8 h-8" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  if (!authorized) {
    return <AuthorizeScreen />;
  }

  return <ChatView />;
}
