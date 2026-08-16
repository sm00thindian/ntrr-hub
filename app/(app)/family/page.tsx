import { redirect } from "next/navigation";

import { InviteForm } from "@/components/family/invite-form";
import { MemberList } from "@/components/family/member-list";
import { PendingInvites } from "@/components/family/pending-invites";
import { PageHeader } from "@/components/layout/page-header";
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
      <PageHeader title="Family" description="Members, roles, and invites" />

      <MemberList
        members={members}
        currentUserId={ctx.userId}
        currentUserRole={ctx.role}
      />

      {canManage ? (
        <p className="text-muted-foreground text-sm">
          Use <span className="text-foreground font-medium">Edit</span> on a member to set their
          display name, mobile for Reliant calls, access, and care persona.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Contact a coordinator (owner or admin) if you need to invite someone or edit member
          details.
        </p>
      )}

      {canManage ? <InviteForm /> : null}

      <PendingInvites
        invites={invites}
        canManage={canManage}
        householdName={ctx.householdName}
      />
    </div>
  );
}