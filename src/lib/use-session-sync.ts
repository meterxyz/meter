"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMeterStore } from "@/lib/store";

const SYNC_INTERVAL = 10_000; // sync every 10 seconds
const SYNC_DEBOUNCE = 2_000; // debounce after message

export function useSessionSync() {
  const userId = useMeterStore((s) => s.userId);
  const projects = useMeterStore((s) => s.projects);
  const authenticated = useMeterStore((s) => s.authenticated);
  const lastSyncRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncToServer = useCallback(async () => {
    if (!userId || !authenticated) return;

    // Create a snapshot hash to avoid unnecessary syncs
    const snapshot = JSON.stringify(
      projects.map((p) => ({
        id: p.id,
        msgCount: p.messages.length,
        lastMsg: p.messages[p.messages.length - 1]?.id,
        totalCost: p.totalCost,
      }))
    );

    if (snapshot === lastSyncRef.current) return;
    lastSyncRef.current = snapshot;

    // Sync each project as a session
    for (const project of projects) {
      if (project.messages.length === 0) continue;

      try {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            session: {
              id: project.id,
              name: project.name,
              totalCost: project.totalCost,
              todayCost: project.todayCost,
              todayTokensIn: project.todayTokensIn,
              todayTokensOut: project.todayTokensOut,
              todayMessageCount: project.todayMessageCount,
              todayDate: project.todayDate,
            },
            messages: project.messages,
          }),
        });
      } catch {
        // Silent fail — will retry on next interval
      }
    }
  }, [userId, authenticated, projects]);

  // Periodic sync
  useEffect(() => {
    if (!authenticated) return;

    const interval = setInterval(syncToServer, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [authenticated, syncToServer]);

  // Debounced sync on message changes
  useEffect(() => {
    if (!authenticated) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(syncToServer, SYNC_DEBOUNCE);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authenticated, projects, syncToServer]);

  // Sync on page unload
  useEffect(() => {
    if (!authenticated) return;

    const handleBeforeUnload = () => {
      if (!userId) return;
      // Use sendBeacon for reliable unload sync
      for (const project of projects) {
        if (project.messages.length === 0) continue;
        const body = JSON.stringify({
          userId,
          session: {
            id: project.id,
            name: project.name,
            totalCost: project.totalCost,
            todayCost: project.todayCost,
            todayTokensIn: project.todayTokensIn,
            todayTokensOut: project.todayTokensOut,
            todayMessageCount: project.todayMessageCount,
            todayDate: project.todayDate,
          },
          messages: project.messages,
        });
        navigator.sendBeacon("/api/sessions", body);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [authenticated, userId, projects]);

  // Load sessions from server on mount
  useEffect(() => {
    if (!userId || !authenticated) return;

    let cancelled = false;

    async function loadSessions() {
      try {
        const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId!)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled || !data.sessions?.length) return;

        const store = useMeterStore.getState();

        // For each server session, restore messages if local is empty
        for (const serverSession of data.sessions) {
          const localProject = store.projects.find((p) => p.id === serverSession.id);
          if (localProject && localProject.messages.length === 0 && serverSession.messages.length > 0) {
            // Restore messages from server
            const messages = serverSession.messages.map((m: Record<string, unknown>) => ({
              id: m.id as string,
              role: m.role as string,
              content: m.content as string,
              model: m.model as string | undefined,
              tokensIn: m.tokens_in as number | undefined,
              tokensOut: m.tokens_out as number | undefined,
              cost: m.cost as number | undefined,
              confidence: m.confidence as number | undefined,
              settled: m.settled as boolean | undefined,
              receiptStatus: m.receipt_status as string | undefined,
              signature: m.signature as string | undefined,
              txHash: m.tx_hash as string | undefined,
              cards: m.cards as unknown,
              timestamp: m.timestamp as number,
            }));

            // Directly update the store
            useMeterStore.setState((s) => ({
              projects: s.projects.map((p) =>
                p.id === serverSession.id
                  ? {
                      ...p,
                      messages,
                      totalCost: serverSession.total_cost ?? p.totalCost,
                      todayCost: serverSession.today_cost ?? p.todayCost,
                      todayTokensIn: serverSession.today_tokens_in ?? p.todayTokensIn,
                      todayTokensOut: serverSession.today_tokens_out ?? p.todayTokensOut,
                      todayMessageCount: serverSession.today_message_count ?? p.todayMessageCount,
                      todayDate: serverSession.today_date ?? p.todayDate,
                    }
                  : p
              ),
            }));
          }
        }
      } catch {
        // Silent fail — localStorage still works as fallback
      }
    }

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, [userId, authenticated]);
}
