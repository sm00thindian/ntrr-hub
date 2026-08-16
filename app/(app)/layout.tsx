import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getUserMembership } from "@/lib/households/queries";
import { canConnectCalendars } from "@/lib/permissions/roles";
import { getPendingConflictCount } from "@/lib/sync/conflict";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Shared app chrome. Keep this layout lean — it re-runs on every client navigation.
 * Heavy footer sync status loads client-side after paint (see AppSiteFooter).
 */
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
  let canSync = false;

  if (membership) {
    canSync = canConnectCalendars(membership.role, membership.persona);
    try {
      conflictCount = await getPendingConflictCount(membership.householdId);
    } catch {
      conflictCount = 0;
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
      canSync={canSync}
    >
      {children}
    </AppShell>
  );
}
