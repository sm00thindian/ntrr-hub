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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Family</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {ctx.householdName}
          <span className="hidden sm:inline"> · manage members and invites</span>
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
          Contact a coordinator (owner or admin) if you need to invite someone or edit member
          details.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Use <span className="text-foreground font-medium">Edit</span> on a member to set their
          display name, mobile for Reliant calls, access, and care persona.
        </p>
      )}
    </div>
  );
}