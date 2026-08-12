"use server";

import { revalidatePath } from "next/cache";

import { requireHouseholdContext } from "@/lib/households/context";
import { humanizeEmailLocalPart } from "@/lib/households/member-label";
import {
  ASSIGNABLE_HOUSEHOLD_ROLES,
  HOUSEHOLD_PERSONAS,
  canManageMembers,
  type HouseholdPersona,
  type HouseholdRole,
} from "@/lib/permissions/roles";
import { normalizeToE164 } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

function revalidateMemberPaths() {
  revalidatePath("/family");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/settings");
}

async function loadHouseholdMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  memberId: string,
) {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, role, persona, is_focus_person")
    .eq("id", memberId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    user_id: string;
    role: HouseholdRole;
    persona: HouseholdPersona | null;
    is_focus_person: boolean | null;
  };
}

/**
 * Full member edit for coordinators: display name, phone, persona, focus,
 * and access role (non-owners). Used by Family page edit form.
 */
export async function updateMemberDetails(memberId: string, formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to edit members." };
  }

  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const persona = String(formData.get("persona") ?? "") as HouseholdPersona;
  const roleRaw = String(formData.get("role") ?? "").trim() as HouseholdRole;
  const isFocusPerson = formData.get("isFocusPerson") === "true" || formData.get("isFocusPerson") === "on";

  if (displayNameRaw.length > 80) {
    return { error: "Name must be 80 characters or fewer." };
  }

  if (!(HOUSEHOLD_PERSONAS as readonly string[]).includes(persona)) {
    return { error: "Invalid care persona." };
  }

  let phoneE164: string | null = null;
  if (phoneRaw) {
    phoneE164 = normalizeToE164(phoneRaw);
    if (!phoneE164) {
      return {
        error: "Enter a valid mobile number (e.g. +1 555 123 4567) or leave phone blank.",
      };
    }
  }

  const supabase = await createClient();
  const member = await loadHouseholdMember(supabase, ctx.householdId, memberId);

  if (!member) {
    return { error: "Member not found." };
  }

  const isOwner = member.role === "owner";

  // Access role: only for non-owners; cannot set owner/caregiver
  let nextRole: HouseholdRole | null = null;
  if (!isOwner && roleRaw) {
    if (roleRaw === "owner" || roleRaw === "caregiver") {
      return {
        error:
          roleRaw === "owner"
            ? "Transferring ownership is not supported yet."
            : "Use Member instead of Caregiver.",
      };
    }
    if (!(ASSIGNABLE_HOUSEHOLD_ROLES as readonly string[]).includes(roleRaw)) {
      return { error: "Invalid access role." };
    }
    nextRole = roleRaw;
  }

  const { error: memberError } = await supabase
    .from("household_members")
    .update({
      persona,
      is_focus_person: isFocusPerson,
      ...(nextRole ? { role: nextRole } : {}),
    })
    .eq("id", memberId)
    .eq("household_id", ctx.householdId);

  if (memberError) {
    return { error: memberError.message };
  }

  // Profile: name + call-target phone (coordinator may set for any household member)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", member.user_id)
    .maybeSingle();

  const email = (profile as { email?: string } | null)?.email ?? "";
  const displayName =
    displayNameRaw || (email ? humanizeEmailLocalPart(email) : "Member");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone_e164: phoneE164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", member.user_id);

  if (profileError) {
    if (profileError.code === "23505") {
      return { error: "That phone number is already linked to another Hub account." };
    }
    return { error: profileError.message };
  }

  revalidateMemberPaths();
  return { success: true as const };
}

export async function updateMemberRole(memberId: string, role: HouseholdRole) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to change roles." };
  }

  if (role === "owner" || role === "caregiver") {
    return {
      error:
        role === "owner"
          ? "Transferring ownership is not supported yet."
          : "Use Member instead of Caregiver.",
    };
  }

  if (!(ASSIGNABLE_HOUSEHOLD_ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const member = await loadHouseholdMember(supabase, ctx.householdId, memberId);

  if (!member) {
    return { error: "Member not found." };
  }

  if (member.role === "owner") {
    return { error: "Cannot change the owner's role." };
  }

  const { error } = await supabase
    .from("household_members")
    .update({ role })
    .eq("id", memberId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidateMemberPaths();
  return { success: true };
}

export async function updateMemberPersona(memberId: string, persona: HouseholdPersona) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to change personas." };
  }

  if (!(HOUSEHOLD_PERSONAS as readonly string[]).includes(persona)) {
    return { error: "Invalid persona." };
  }

  const supabase = await createClient();
  const member = await loadHouseholdMember(supabase, ctx.householdId, memberId);

  if (!member) {
    return { error: "Member not found." };
  }

  const { error } = await supabase
    .from("household_members")
    .update({ persona })
    .eq("id", memberId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidateMemberPaths();
  return { success: true };
}

export async function updateMemberFocusPerson(memberId: string, isFocusPerson: boolean) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to change focus person." };
  }

  const supabase = await createClient();
  const member = await loadHouseholdMember(supabase, ctx.householdId, memberId);

  if (!member) {
    return { error: "Member not found." };
  }

  const { error } = await supabase
    .from("household_members")
    .update({ is_focus_person: isFocusPerson })
    .eq("id", memberId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidateMemberPaths();
  return { success: true };
}

export async function removeMember(memberId: string) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to remove members." };
  }

  const supabase = await createClient();
  const member = await loadHouseholdMember(supabase, ctx.householdId, memberId);

  if (!member) {
    return { error: "Member not found." };
  }

  if (member.role === "owner") {
    return { error: "Cannot remove the household owner." };
  }

  if (member.user_id === ctx.userId) {
    return { error: "You cannot remove yourself. Ask another admin." };
  }

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("id", memberId)
    .eq("household_id", ctx.householdId);

  if (error) {
    return { error: error.message };
  }

  revalidateMemberPaths();
  return { success: true };
}