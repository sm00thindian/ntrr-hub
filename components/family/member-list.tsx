"use client";

import { useState, useTransition } from "react";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  removeMember,
  updateMemberFocusPerson,
  updateMemberPersona,
  updateMemberRole,
} from "@/lib/households/member-actions";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import { MicroFieldHelp } from "@/components/ui/field-help";
import {
  ACCESS_FIELD_HELP,
  ASSIGNABLE_HOUSEHOLD_ROLES,
  FOCUS_PERSON_FIELD_HELP,
  HOUSEHOLD_PERSONAS,
  HOUSEHOLD_PERSONA_HINTS,
  HOUSEHOLD_PERSONA_LABELS,
  HOUSEHOLD_ROLE_HINTS,
  HOUSEHOLD_ROLE_LABELS,
  PERSONA_FIELD_HELP,
  canManageMembers,
  type HouseholdPersona,
  type HouseholdRole,
} from "@/lib/permissions/roles";

type MemberListProps = {
  members: HouseholdMember[];
  currentUserId: string;
  currentUserRole: HouseholdRole;
};

export function MemberList({ members, currentUserId, currentUserRole }: MemberListProps) {
  const canManage = canManageMembers(currentUserRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
        <CardDescription>
          Access controls the board; care persona describes their place in the network (including
          self-advocates).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const canEdit = canManage && member.role !== "owner" && !isSelf;

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">
                    {memberDisplayLabel(member.email, member.displayName)}
                    {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                    {member.isFocusPerson ? (
                      <span className="text-brand ml-2 text-xs font-medium">Focus</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <RoleBadge role={member.role} />
                    <PersonaBadge persona={member.persona} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  {canEdit ? (
                    <>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <MicroFieldHelp label="Access" help={ACCESS_FIELD_HELP} />
                        <select
                          defaultValue={member.role === "caregiver" ? "member" : member.role}
                          disabled={pending}
                          className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          title={HOUSEHOLD_ROLE_HINTS[member.role]}
                          onChange={(e) => {
                            setError(null);
                            startTransition(async () => {
                              const result = await updateMemberRole(
                                member.id,
                                e.target.value as HouseholdRole,
                              );
                              if (result?.error) {
                                setError(result.error);
                              }
                            });
                          }}
                        >
                          {ASSIGNABLE_HOUSEHOLD_ROLES.map((role) => (
                            <option key={role} value={role} title={HOUSEHOLD_ROLE_HINTS[role]}>
                              {HOUSEHOLD_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <MicroFieldHelp label="Care persona" help={PERSONA_FIELD_HELP} />
                        <select
                          defaultValue={member.persona}
                          disabled={pending}
                          className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          title={HOUSEHOLD_PERSONA_HINTS[member.persona]}
                          onChange={(e) => {
                            setError(null);
                            startTransition(async () => {
                              const result = await updateMemberPersona(
                                member.id,
                                e.target.value as HouseholdPersona,
                              );
                              if (result?.error) {
                                setError(result.error);
                              }
                            });
                          }}
                        >
                          {HOUSEHOLD_PERSONAS.map((persona) => (
                            <option
                              key={persona}
                              value={persona}
                              title={HOUSEHOLD_PERSONA_HINTS[persona]}
                            >
                              {HOUSEHOLD_PERSONA_LABELS[persona]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                        title={FOCUS_PERSON_FIELD_HELP}
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input"
                          checked={member.isFocusPerson}
                          disabled={pending}
                          onChange={(e) => {
                            setError(null);
                            startTransition(async () => {
                              const result = await updateMemberFocusPerson(
                                member.id,
                                e.target.checked,
                              );
                              if (result?.error) {
                                setError(result.error);
                              }
                            });
                          }}
                        />
                        <MicroFieldHelp label="Care focus person" help={FOCUS_PERSON_FIELD_HELP} />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await removeMember(member.id);
                            if (result?.error) {
                              setError(result.error);
                            }
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
