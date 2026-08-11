"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireHouseholdContext } from "@/lib/households/context";
import { getInviteByToken } from "@/lib/households/queries";
import { upsertProfile } from "@/lib/profiles/actions";
import {
  ASSIGNABLE_HOUSEHOLD_ROLES,
  HOUSEHOLD_PERSONAS,
  canManageMembers,
  type HouseholdPersona,
  type HouseholdRole,
} from "@/lib/permissions/roles";
import { buildInviteShareText } from "@/lib/households/invite-message";
import { normalizeToE164 } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createInvite(formData: FormData) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to invite members." };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "member") as HouseholdRole;
  const persona = String(formData.get("persona") ?? "care_partner") as HouseholdPersona;
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "A valid email address is required." };
  }

  if (role === "owner" || !(ASSIGNABLE_HOUSEHOLD_ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid access role for invite." };
  }

  if (!(HOUSEHOLD_PERSONAS as readonly string[]).includes(persona)) {
    return { error: "Invalid care persona for invite." };
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

  if (email === normalizeEmail(ctx.userEmail)) {
    return { error: "You cannot invite yourself." };
  }

  const { getHouseholdMembers } = await import("@/lib/households/queries");
  const members = await getHouseholdMembers(ctx.householdId);

  if (members.some((m) => m.email.toLowerCase() === email)) {
    return { error: "This person is already a household member." };
  }

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      household_id: ctx.householdId,
      email,
      role,
      persona,
      phone_e164: phoneE164,
      invited_by: ctx.userId,
    })
    .select("token")
    .single();

  if (error || !invite) {
    return { error: error?.message ?? "Could not create invite." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${siteUrl}/invite/${(invite as { token: string }).token}`;
  const shareText = buildInviteShareText({
    householdName: ctx.householdName,
    inviteUrl,
    phoneE164,
  });

  revalidatePath("/family");
  revalidatePath("/dashboard");

  return { success: true, inviteUrl, shareText, phoneE164 };
}

export async function revokeInvite(inviteId: string) {
  const ctx = await requireHouseholdContext();

  if (!canManageMembers(ctx.role)) {
    return { error: "You do not have permission to revoke invites." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("household_id", ctx.householdId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/family");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/login?next=/invite/${token}`);
  }

  await upsertProfile(user);

  const invite = await getInviteByToken(token);

  if (!invite) {
    return { error: "Invite not found." };
  }

  if (invite.acceptedAt) {
    redirect("/dashboard");
  }

  if (invite.revokedAt) {
    return { error: "This invite has been revoked." };
  }

  if (invite.isExpired) {
    return { error: "This invite has expired." };
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    return {
      error: `This invite was sent to ${invite.email}. Sign in with that email to accept.`,
    };
  }

  // Security-definer RPC: invitees are not members yet, so client INSERT into
  // household_members is blocked by RLS (owners/admins only).
  const { error: acceptError } = await supabase.rpc("accept_household_invite", {
    invite_token: token,
  });

  if (acceptError) {
    const message = acceptError.message ?? "Could not accept invite.";
    // Surface clean copy without Postgres exception prefixes when possible
    if (message.includes("already belong")) {
      return { error: "You already belong to a household." };
    }
    if (message.includes("revoked")) {
      return { error: "This invite has been revoked." };
    }
    if (message.includes("expired")) {
      return { error: "This invite has expired." };
    }
    if (message.includes("already been accepted")) {
      redirect("/dashboard");
    }
    if (message.includes("Sign in with that email")) {
      return { error: message.replace(/^.*exception:\s*/i, "") };
    }
    return { error: message };
  }

  // Full-tree revalidate so invitees (incl. self-advocates) don't briefly see
  // the create-household empty state from a stale RSC payload.
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/family");
  revalidatePath("/settings");
  revalidatePath("/tasks");
  redirect("/dashboard");
}