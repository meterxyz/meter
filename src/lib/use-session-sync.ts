"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMeterStore } from "@/lib/store";
import { useWorkspaceStore } from "@/lib/workspace-store";

const SYNC_INTERVAL = 10_000; // sync every 10 seconds
const SYNC_DEBOUNCE = 2_000; // debounce after message

export function useSessionSync() {
  const userId = useMeterStore((s) => s.userId);
  const projects = useMeterStore((s) => s.projects);
  const authenticated = useMeterStore((s) => s.authenticated);
  const lastSyncRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const mapServerMessage = (m: Record<string, unknown>) => ({
    id: m.id as string,
    role: m.role as "user" | "assistant",
    content: (m.content as string) ?? "",
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
  });

  const buildProjectFromSession = (session: Record<string, unknown>) => {
    const messages = Array.isArray(session.messages)
      ? session.messages.map((m: Record<string, unknown>) => mapServerMessage(m))
      : [];
    const totalFromMessages = messages
      .filter((m) => m.role === "assistant" && m.cost != null)
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);
    const totalFromSession = Number(session.total_cost ?? 0);

    return {
      id: session.id as string,
      name: (session.project_name as string) ?? (session.name as string) ?? (session.id as string),
      messages,
      isStreaming: false,
      settlementError: null,
      chatBlocked: false,
      todayCost: Number(session.today_cost ?? 0),
      todayTokensIn: Number(session.today_tokens_in ?? 0),
      todayTokensOut: Number(session.today_tokens_out ?? 0),
      todayMessageCount: Number(session.today_message_count ?? 0),
      todayByModel: {},
      todayDate: (session.today_date as string) ?? todayStr(),
      totalCost: Math.max(totalFromSession, totalFromMessages),
    };
  };

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
    let allOk = true;

    // Sync each project as a session
    for (const project of projects) {

      try {
        const res = await fetch("/api/sessions", {
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
            messages: project.messages ?? [],
          }),
        });
        if (!res.ok) {
          allOk = false;
        }
      } catch {
        // Silent fail — will retry on next interval
        allOk = false;
      }
    }

    if (allOk) {
      lastSyncRef.current = snapshot;
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
        const serverSessions = data.sessions as Record<string, unknown>[];

        const hasLocalMessages = store.projects.some((p) => p.messages.length > 0);
        if (!hasLocalMessages) {
          const serverProjects = serverSessions.map((s) => buildProjectFromSession(s));
          if (serverProjects.length > 0) {
            useMeterStore.setState((s) => ({
              projects: serverProjects,
              activeProjectId: serverProjects.some((p) => p.id === s.activeProjectId)
                ? s.activeProjectId
                : serverProjects[0].id,
            }));
            const activeSessionId = serverProjects.some((p) => p.id === store.activeProjectId)
              ? store.activeProjectId
              : serverProjects[0].id;
            useWorkspaceStore
              .getState()
              .upsertCompaniesFromSessions(serverSessions, activeSessionId);
          } else {
            useWorkspaceStore.getState().upsertCompaniesFromSessions(serverSessions, store.activeProjectId);
          }
          return;
        }

        const localById = new Map(store.projects.map((p) => [p.id, p]));
        const merged = [...store.projects];
        let changed = false;

        for (const serverSession of serverSessions) {
          const serverId = serverSession.id as string;
          const localProject = localById.get(serverId);
          if (!localProject) {
            merged.push(buildProjectFromSession(serverSession));
            changed = true;
            continue;
          }

          if (localProject.messages.length === 0 && Array.isArray(serverSession.messages) && serverSession.messages.length > 0) {
            const idx = merged.findIndex((p) => p.id === serverId);
            if (idx >= 0) {
              merged[idx] = buildProjectFromSession(serverSession);
              changed = true;
            }
          }
        }

        let nextActiveProjectId = store.activeProjectId;
        if (changed) {
          nextActiveProjectId = merged.some((p) => p.id === store.activeProjectId)
            ? store.activeProjectId
            : merged[0]?.id ?? store.activeProjectId;
          useMeterStore.setState((s) => ({
            projects: merged,
            activeProjectId: nextActiveProjectId,
          }));
        }

        useWorkspaceStore.getState().upsertCompaniesFromSessions(serverSessions, nextActiveProjectId);
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
