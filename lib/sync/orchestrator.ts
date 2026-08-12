import {
  getConnectedAppleCalDavIntegrationAdmin,
  getConnectedGoogleIntegrationAdmin,
} from "@/lib/integrations/queries";
import { pullAppleCalDavCalendar } from "@/lib/sync/apple/caldav";
import { pullGoogleCalendar, pushGoogleCalendarEvent } from "@/lib/sync/google/calendar";
import { pullGoogleTasks, pushGoogleTask } from "@/lib/sync/google/tasks";
import { GOOGLE_TASKS_SYNC_ENABLED } from "@/lib/sync/google/tasks-config";
import {
  fetchPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
  markOutboxProcessing,
} from "@/lib/sync/outbox";
import { runPostSyncAgents } from "@/lib/ai/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runGoogleSync(householdId: string) {
  const account = await getConnectedGoogleIntegrationAdmin(householdId);
  if (!account) {
    return { skipped: true as const, reason: "Google not connected" };
  }

  const admin = createAdminClient();

  try {
    await pullGoogleCalendar(account);
    if (GOOGLE_TASKS_SYNC_ENABLED) {
      await pullGoogleTasks(account);
    }

    const outbox = await fetchPendingOutbox(householdId, "google");

    for (const entry of outbox) {
      await markOutboxProcessing(entry.id);

      try {
        if (entry.entity_type === "task") {
          if (!GOOGLE_TASKS_SYNC_ENABLED) {
            // Drain legacy task outbox rows without pushing to Google Tasks.
            await markOutboxDone(entry.id);
            continue;
          }
          await pushGoogleTask(account, {
            entityId: entry.entity_id,
            operation: entry.operation,
            payload: (entry.payload ?? {}) as Record<string, unknown>,
          });
        } else if (entry.entity_type === "calendar_event") {
          await pushGoogleCalendarEvent(account, {
            entityId: entry.entity_id,
            operation: entry.operation,
            payload: (entry.payload ?? {}) as Record<string, unknown>,
          });
        }

        await markOutboxDone(entry.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync push failed";
        await markOutboxFailed(entry.id, entry.attempts ?? 0, message);
      }
    }

    // Use updated_at as last successful sync time (do not rewrite metadata here —
    // tokens may be decrypted in-memory and must stay encryptJson-encoded at rest).
    await admin
      .from("integration_accounts")
      .update({ status: "connected", updated_at: new Date().toISOString() })
      .eq("id", account.id);

    return { skipped: false as const, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sync failed";

    await admin
      .from("integration_accounts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", account.id);

    return { skipped: false as const, success: false, error: message };
  }
}

export async function runAppleCalDavSync(householdId: string) {
  const account = await getConnectedAppleCalDavIntegrationAdmin(householdId);
  if (!account) {
    return { skipped: true as const, reason: "Apple CalDAV not connected" };
  }

  try {
    await pullAppleCalDavCalendar(account);
    return { skipped: false as const, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple CalDAV sync failed";
    const admin = createAdminClient();
    await admin
      .from("integration_accounts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", account.id);
    return { skipped: false as const, success: false, error: message };
  }
}

export async function runHouseholdSync(householdId: string) {
  const google = await runGoogleSync(householdId);
  const apple = await runAppleCalDavSync(householdId);

  let agents: Record<string, unknown> | null = null;
  if (
    (!google.skipped && google.success) ||
    (!apple.skipped && apple.success)
  ) {
    try {
      agents = await runPostSyncAgents(householdId);
    } catch {
      agents = { error: "AI agents failed after sync." };
    }
  }

  return { google, apple, agents };
}

export async function runAllGoogleSyncs() {
  const admin = createAdminClient();

  const { data: accounts } = await admin
    .from("integration_accounts")
    .select("household_id")
    .eq("provider", "google")
    .eq("status", "connected");

  const results = [];

  for (const account of accounts ?? []) {
    const result = await runGoogleSync(account.household_id as string);
    results.push({ householdId: account.household_id, ...result });
  }

  return results;
}