"use client";

import { useMeterStore } from "@/lib/store";
import { ChatView } from "@/components/chat-view";
import { LoginScreen } from "@/components/login-screen";
import { AuthorizeScreen } from "@/components/authorize-screen";
import { GmailScreen } from "@/components/gmail-screen";

export default function Home() {
  const authenticated = useMeterStore((s) => s.authenticated);
  const cardOnFile = useMeterStore((s) => s.cardOnFile);
  const connectedServices = useMeterStore((s) => s.connectedServices);
  const gmailConnected = !!connectedServices.gmail;

  // Flow: Email/Passkey → Card → Gmail → Chat
  if (!authenticated) {
    return <LoginScreen />;
  }

  if (!cardOnFile) {
    return <AuthorizeScreen />;
  }

  if (!gmailConnected) {
    return <GmailScreen />;
  }

  return <ChatView />;
}
