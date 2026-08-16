"use server";

import { requireHouseholdContext } from "@/lib/households/context";
import { getHouseholdSyncStatus } from "@/lib/integrations/status";
import { getPendingConflictCount } from "@/lib/sync/conflict";

/** Footer sync card — loaded client-side so app layout stays light on every nav. */
export async function fetchFooterSyncStatus() {
  try {
    const ctx = await requireHouseholdContext();
    return await getHouseholdSyncStatus(ctx.householdId);
  } catch {
    return null;
  }
}

/** Nav conflict badge — update without full router.refresh. */
export async function fetchPendingConflictCount() {
  try {
    const ctx = await requireHouseholdContext();
    return await getPendingConflictCount(ctx.householdId);
  } catch {
    return 0;
  }
}
