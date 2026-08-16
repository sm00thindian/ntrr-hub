"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTaskStatus } from "@/lib/tasks/actions";

type ServerTaskRow = {
  entityId?: string;
  status?: string;
};

/**
 * Instant Done/reopen on dashboard boards: paint green and re-sort immediately,
 * then confirm with the server and soft-refresh in the background.
 */
export function useOptimisticTaskDone(serverItems: ServerTaskRow[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  /** Local status wins over server props until refresh catches up (or error rollback). */
  const [overrides, setOverrides] = useState<Record<string, "done" | "todo">>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // Drop overrides once server props match (after router.refresh / live refresh).
  useEffect(() => {
    setOverrides((prev) => {
      if (!Object.keys(prev).length) return prev;
      let changed = false;
      const next = { ...prev };
      for (const [id, status] of Object.entries(prev)) {
        const row = serverItems.find((i) => i.entityId === id);
        if (row && row.status === status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [serverItems]);

  const isTaskDone = useCallback(
    (entityId: string | undefined, serverStatus?: string) => {
      if (!entityId) return serverStatus === "done";
      const override = overrides[entityId];
      if (override === "done") return true;
      if (override === "todo") return false;
      return serverStatus === "done";
    },
    [overrides],
  );

  const isPending = useCallback(
    (entityId: string | undefined) => Boolean(entityId && pendingIds.has(entityId)),
    [pendingIds],
  );

  const markDone = useCallback(
    (taskId: string) => {
      setActionError(null);
      // Paint immediately — outside startTransition so it is not deferred.
      setOverrides((prev) => ({ ...prev, [taskId]: "done" }));
      setPendingIds((prev) => new Set(prev).add(taskId));

      startTransition(async () => {
        const result = await updateTaskStatus(taskId, "done");
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        if (result?.error) {
          setOverrides((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          setActionError(result.error);
          return;
        }
        // Soft refresh in background; optimistic row stays green/sorted.
        router.refresh();
      });
    },
    [router],
  );

  const reopen = useCallback(
    (taskId: string) => {
      setActionError(null);
      setOverrides((prev) => ({ ...prev, [taskId]: "todo" }));
      setPendingIds((prev) => new Set(prev).add(taskId));

      startTransition(async () => {
        const result = await updateTaskStatus(taskId, "todo");
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        if (result?.error) {
          setOverrides((prev) => {
            const next = { ...prev };
            // Restore done if server still thinks it is done / we had marked done.
            next[taskId] = "done";
            return next;
          });
          setActionError(result.error);
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  return {
    isTaskDone,
    isPending,
    markDone,
    reopen,
    actionError,
  };
}
