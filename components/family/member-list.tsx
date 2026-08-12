"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

import { PersonaBadge, RoleBadge } from "@/components/family/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MicroFieldHelp } from "@/components/ui/field-help";
import {
  removeMember,
  updateMemberDetails,
} from "@/lib/households/member-actions";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import { formatPhoneDisplay } from "@/lib/phone";
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
  type HouseholdRole,
} from "@/lib/permissions/roles";

type MemberListProps = {
  members: HouseholdMember[];
  currentUserId: string;
  currentUserRole: HouseholdRole;
};

export function MemberList({ members, currentUserId, currentUserRole }: MemberListProps) {
  const canManage = canManageMembers(currentUserRole);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
        <CardDescription>
          {canManage
            ? "Edit names, phones (Reliant call targets), access, and care personas for anyone in the household."
            : "Access controls the board; care persona describes their place in the network."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isOwner = member.role === "owner";
            const canEditDetails = canManage;
            const canRemove = canManage && !isOwner && !isSelf;
            const isEditing = editingId === member.id;
            const label = memberDisplayLabel(member.email, member.displayName);
            const phoneLabel = formatPhoneDisplay(member.phoneE164);

            return (
              <li key={member.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">
                      {label}
                      {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                      {member.isFocusPerson ? (
                        <span className="text-brand ml-2 text-xs font-medium">Focus</span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                    {phoneLabel ? (
                      <p className="text-muted-foreground truncate text-xs">Mobile · {phoneLabel}</p>
                    ) : canManage ? (
                      <p className="text-muted-foreground text-xs">No mobile on file</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <RoleBadge role={member.role} />
                      <PersonaBadge persona={member.persona} />
                    </div>
                  </div>

                  {canEditDetails ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isEditing ? "outline" : "default"}
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          setEditingId(isEditing ? null : member.id);
                        }}
                      >
                        {isEditing ? (
                          <>
                            <X className="h-4 w-4" aria-hidden />
                            Close
                          </>
                        ) : (
                          <>
                            <Pencil className="h-4 w-4" aria-hidden />
                            Edit
                          </>
                        )}
                      </Button>
                      {canRemove && !isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${label} from this household? They will lose access to the board.`,
                              )
                            ) {
                              return;
                            }
                            setError(null);
                            setMessage(null);
                            startTransition(async () => {
                              const result = await removeMember(member.id);
                              if (result?.error) {
                                setError(result.error);
                                return;
                              }
                              setMessage(`${label} removed.`);
                              router.refresh();
                            });
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {isEditing && canEditDetails ? (
                  <form
                    className="border-border bg-muted/20 mt-4 space-y-4 rounded-xl border p-3 sm:p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setError(null);
                      setMessage(null);
                      const formData = new FormData(event.currentTarget);
                      startTransition(async () => {
                        const result = await updateMemberDetails(member.id, formData);
                        if (result?.error) {
                          setError(result.error);
                          return;
                        }
                        setMessage(`Saved details for ${label}.`);
                        setEditingId(null);
                        router.refresh();
                      });
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`displayName-${member.id}`}>Display name</Label>
                        <Input
                          id={`displayName-${member.id}`}
                          name="displayName"
                          defaultValue={member.displayName ?? label}
                          maxLength={80}
                          autoComplete="name"
                          placeholder="How they appear on tasks"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`phone-${member.id}`}>Mobile (call target)</Label>
                        <Input
                          id={`phone-${member.id}`}
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          defaultValue={member.phoneE164 ?? ""}
                          placeholder="+1 555 123 4567"
                        />
                        <p className="text-muted-foreground text-[11px] leading-snug">
                          Reliant may call this number for confirmation. Leave blank to clear.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <MicroFieldHelp label="Care persona" help={PERSONA_FIELD_HELP} />
                        <select
                          id={`persona-${member.id}`}
                          name="persona"
                          defaultValue={member.persona}
                          disabled={pending}
                          className="border-input bg-background flex h-11 w-full rounded-md border px-3 text-sm"
                          title={HOUSEHOLD_PERSONA_HINTS[member.persona]}
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
                      </div>
                      {!isOwner ? (
                        <div className="space-y-2">
                          <MicroFieldHelp label="Access" help={ACCESS_FIELD_HELP} />
                          <select
                            id={`role-${member.id}`}
                            name="role"
                            defaultValue={
                              member.role === "caregiver" ? "member" : member.role
                            }
                            disabled={pending}
                            className="border-input bg-background flex h-11 w-full rounded-md border px-3 text-sm"
                            title={HOUSEHOLD_ROLE_HINTS[member.role]}
                          >
                            {ASSIGNABLE_HOUSEHOLD_ROLES.map((role) => (
                              <option
                                key={role}
                                value={role}
                                title={HOUSEHOLD_ROLE_HINTS[role]}
                              >
                                {HOUSEHOLD_ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Access</Label>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            Owner — access cannot be changed here.
                          </p>
                          <input type="hidden" name="role" value="owner" />
                        </div>
                      )}
                    </div>

                    <label
                      className="flex cursor-pointer items-start gap-2 text-sm"
                      title={FOCUS_PERSON_FIELD_HELP}
                    >
                      <input
                        type="checkbox"
                        name="isFocusPerson"
                        value="true"
                        defaultChecked={member.isFocusPerson}
                        disabled={pending}
                        className="border-input mt-0.5 size-4 rounded"
                      />
                      <span>
                        <span className="font-medium">Care focus person</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                          {FOCUS_PERSON_FIELD_HELP}
                        </span>
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={pending}>
                        {pending ? "Saving…" : "Save changes"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      {canRemove ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive sm:ml-auto"
                          disabled={pending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${label} from this household? They will lose access to the board.`,
                              )
                            ) {
                              return;
                            }
                            setError(null);
                            startTransition(async () => {
                              const result = await removeMember(member.id);
                              if (result?.error) {
                                setError(result.error);
                                return;
                              }
                              setEditingId(null);
                              setMessage(`${label} removed.`);
                              router.refresh();
                            });
                          }}
                        >
                          Remove from household
                        </Button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>

        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
