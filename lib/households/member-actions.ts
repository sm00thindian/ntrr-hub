"use server";

import { revalidatePath } from "next/cache";

import { requireHouseholdContext } from "@/lib/households/context";
import {
  ASSIGNABLE_HOUSEHOLD_ROLES,
  HOUSEHOLD_PERSONAS,
  canManageMembers,
  type HouseholdPersona,
  type HouseholdRole,
} from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export async function updateMemberRole(memberId: string, role: HouseholdRole) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to change roles." };
  }

  if (role === "owner" || role === "caregiver") {
    return { error: role === "owner" ? "Transferring ownership is not supported yet." : "Use Member instead of Caregiver." };
  }

  if (!(ASSIGNABLE_HOUSEHOLD_ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();

  const { data: target, error: fetchError } = await supabase
    .from("household_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (fetchError || !target) {
    return { error: "Member not found." };
  }

  const member = target as { id: string; user_id: string; role: HouseholdRole };

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

  revalidatePath("/family");
  revalidatePath("/dashboard");
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

  const { data: target, error: fetchError } = await supabase
    .from("household_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (fetchError || !target) {
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

  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMemberFocusPerson(memberId: string, isFocusPerson: boolean) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to change focus person." };
  }

  const supabase = await createClient();

  const { data: target, error: fetchError } = await supabase
    .from("household_members")
    .select("id")
    .eq("id", memberId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (fetchError || !target) {
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

  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function removeMember(memberId: string) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to remove members." };
  }

  const supabase = await createClient();

  const { data: target, error: fetchError } = await supabase
    .from("household_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("household_id", ctx.householdId)
    .maybeSingle();

  if (fetchError || !target) {
    return { error: "Member not found." };
  }

  const member = target as { id: string; user_id: string; role: HouseholdRole };

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

  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { success: true };
}