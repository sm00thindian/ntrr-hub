import {
  getAllConnectedAppleIntegrationsAdmin,
  getAllConnectedGoogleIntegrationsAdmin,
} from "@/lib/integrations/queries";
import { pullAppleCalDavCalendar } from "@/lib/sync/apple/caldav";
import { pullGoogleCalendar } from "@/lib/sync/google/calendar";
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

export async function runGoogleSync(
  householdId: string,
  options?: { forceFullCalendarPull?: boolean },
) {
  const accounts = await getAllConnectedGoogleIntegrationsAdmin(householdId);
  if (!accounts.length) {
    return { skipped: true as const, reason: "Google not connected" };
  }

  const admin = createAdminClient();
  const errors: string[] = [];
  const forceFull = options?.forceFullCalendarPull === true;

  try {
    for (const account of accounts) {
      try {
        await pullGoogleCalendar(account, { forceFull });
        if (GOOGLE_TASKS_SYNC_ENABLED) {
          await pullGoogleTasks(account);
        }
        await admin
          .from("integration_accounts")
          .update({ status: "connected", updated_at: new Date().toISOString() })
          .eq("id", account.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Google sync failed";
        errors.push(message);
        await admin
          .from("integration_accounts")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    }

    // Outbound Google pushes (tasks only when enabled). Calendar is pull-only.
    const pushAccount = accounts[0]!;
    const outbox = await fetchPendingOutbox(householdId, "google");

    for (const entry of outbox) {
      await markOutboxProcessing(entry.id);

      try {
        if (entry.entity_type === "task") {
          if (!GOOGLE_TASKS_SYNC_ENABLED) {
            await markOutboxDone(entry.id);
            continue;
          }
          await pushGoogleTask(pushAccount, {
            entityId: entry.entity_id,
            operation: entry.operation,
            payload: (entry.payload ?? {}) as Record<string, unknown>,
          });
        } else if (entry.entity_type === "calendar_event") {
          // Read-only OAuth: never create/edit/delete Google events. Drain legacy rows.
          await markOutboxDone(entry.id);
          continue;
        }

        await markOutboxDone(entry.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync push failed";
        await markOutboxFailed(entry.id, entry.attempts ?? 0, message);
      }
    }

    if (errors.length && errors.length === accounts.length) {
      return { skipped: false as const, success: false, error: errors.join(" ") };
    }

    return { skipped: false as const, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sync failed";
    return { skipped: false as const, success: false, error: message };
  }
}

export async function runAppleCalDavSync(householdId: string) {
  const accounts = await getAllConnectedAppleIntegrationsAdmin(householdId);
  if (!accounts.length) {
    return { skipped: true as const, reason: "Apple CalDAV not connected" };
  }

  const admin = createAdminClient();
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      await pullAppleCalDavCalendar(account);
      await admin
        .from("integration_accounts")
        .update({ status: "connected", updated_at: new Date().toISOString() })
        .eq("id", account.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apple CalDAV sync failed";
      errors.push(message);
      await admin
        .from("integration_accounts")
        .update({ status: "error", updated_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  }

  if (errors.length && errors.length === accounts.length) {
    return { skipped: false as const, success: false, error: errors.join(" ") };
  }

  return { skipped: false as const, success: true };
}

export async function runHouseholdSync(
  householdId: string,
  options?: { forceFullCalendarPull?: boolean },
) {
  const google = await runGoogleSync(householdId, options);
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