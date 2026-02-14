"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ChatView } from "@/components/chat-view";
import { LoginScreen } from "@/components/login-screen";

export default function Home() {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="font-mono text-sm text-muted-foreground animate-pulse">
          initializing meter...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  return <ChatView />;
}
