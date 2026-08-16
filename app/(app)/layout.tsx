import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getUserMembership } from "@/lib/households/queries";
import { getHouseholdSyncStatus } from "@/lib/integrations/status";
import { canConnectCalendars } from "@/lib/permissions/roles";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getUserMembership(user.id);
  let conflictCount = 0;
  let syncStatus: Awaited<ReturnType<typeof getHouseholdSyncStatus>> | null = null;
  let canSync = false;

  if (membership) {
    try {
      conflictCount = await getPendingConflictCount(membership.householdId);
    } catch {
      conflictCount = 0;
    }
    // Footer sync for coordinators and self-advocates (calendar context on every app page)
    canSync = canConnectCalendars(membership.role, membership.persona);
    try {
      syncStatus = await getHouseholdSyncStatus(membership.householdId);
    } catch {
      syncStatus = null;
    }
  }

  return (
    <AppShell
      userEmail={user.email}
      householdName={membership?.householdName}
      householdRole={membership?.role}
      householdPersona={membership?.persona}
      householdId={membership?.householdId}
      conflictCount={conflictCount}
      syncStatus={syncStatus}
      canSync={canSync}
    >
      {children}
    </AppShell>
  );
}
