import { redirect } from "next/navigation";

import { getUserMembership } from "@/lib/households/queries";
import { upsertProfile } from "@/lib/profiles/actions";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdPersona, HouseholdRole } from "@/lib/permissions/roles";

export type HouseholdContext = {
  userId: string;
  userEmail: string;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  persona: HouseholdPersona;
  isFocusPerson: boolean;
};

export async function requireHouseholdContext(): Promise<HouseholdContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  await upsertProfile(user);

  const membership = await getUserMembership(user.id);

  if (!membership) {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    userEmail: user.email,
    householdId: membership.householdId,
    householdName: membership.householdName,
    role: membership.role,
    persona: membership.persona,
    isFocusPerson: membership.isFocusPerson,
  };
}