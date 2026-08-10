import { redirect } from "next/navigation";

import { InviteForm } from "@/components/family/invite-form";
import { MemberList } from "@/components/family/member-list";
import { PendingInvites } from "@/components/family/pending-invites";
import { requireHouseholdContext } from "@/lib/households/context";
import { getHouseholdMembers, getPendingInvites } from "@/lib/households/queries";
import { canManageMembers } from "@/lib/permissions/roles";

export default async function FamilyPage() {
  const ctx = await requireHouseholdContext();
  const canManage = canManageMembers(ctx.role);

  const [members, invites] = await Promise.all([
    getHouseholdMembers(ctx.householdId),
    getPendingInvites(ctx.householdId),
  ]);

  if (!members.length) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Family</h1>
        <p className="mt-1 text-muted-foreground">
          {ctx.householdName} · manage members and invites
        </p>
      </div>

      {canManage ? <InviteForm /> : null}

      <MemberList
        members={members}
        currentUserId={ctx.userId}
        currentUserRole={ctx.role}
      />

      <PendingInvites
        invites={invites}
        canManage={canManage}
        householdName={ctx.householdName}
      />

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Contact an admin if you need to invite someone or change roles.
        </p>
      ) : null}
    </div>
  );
}