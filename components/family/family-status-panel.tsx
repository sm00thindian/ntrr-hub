import Link from "next/link";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FamilyStatus } from "@/lib/households/queries";
import { cn } from "@/lib/utils";

export function FamilyStatusPanel({ status }: { status: FamilyStatus }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Family overview</CardTitle>
          <CardDescription>
            {status.memberCount} member{status.memberCount === 1 ? "" : "s"}
            {status.pendingInviteCount > 0
              ? ` · ${status.pendingInviteCount} pending invite${status.pendingInviteCount === 1 ? "" : "s"}`
              : ""}
            {" · "}roles & care personas
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/family">Manage</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {status.members.map((member) => (
            <li
              key={member.userId}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5",
                member.isCurrentUser ? "border-brand/25 bg-brand/8" : "bg-card",
              )}
            >
              <span className="truncate text-sm">
                {member.email}
                {member.isCurrentUser ? (
                  <span className="text-muted-foreground"> (you)</span>
                ) : null}
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <RoleBadge role={member.role} />
                <PersonaBadge persona={member.persona} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}