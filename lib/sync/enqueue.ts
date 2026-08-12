import { getConnectedGoogleIntegration } from "@/lib/integrations/queries";
import { GOOGLE_TASKS_SYNC_ENABLED } from "@/lib/sync/google/tasks-config";
import { enqueueSyncOutbox } from "@/lib/sync/outbox";

export async function enqueueGoogleTaskSync(params: {
  householdId: string;
  taskId: string;
  operation: "create" | "update" | "delete";
  payload?: Record<string, unknown>;
}) {
  if (!GOOGLE_TASKS_SYNC_ENABLED) {
    return;
  }

  const integration = await getConnectedGoogleIntegration(params.householdId);
  if (!integration) {
    return;
  }

  await enqueueSyncOutbox({
    householdId: params.householdId,
    provider: "google",
    entityType: "task",
    entityId: params.taskId,
    operation: params.operation,
    payload: params.payload,
  });
}