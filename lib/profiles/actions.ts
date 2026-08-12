"use server";

import { revalidatePath } from "next/cache";

import {
  displayNameFromAuthMetadata,
  humanizeEmailLocalPart,
} from "@/lib/households/member-label";
import { normalizeToE164 } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Ensure a profiles row exists. Seeds display_name from OAuth metadata (or a
 * humanized email local-part) only when the profile has no name yet — never
 * overwrites a name the user already set.
 */
export async function upsertProfile(user: AuthUserLike) {
  if (!user.email) {
    return;
  }

  const supabase = await createClient();
  const email = user.email.toLowerCase();

  const { data: existing } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const currentName = (existing as { display_name?: string | null } | null)?.display_name?.trim();
  const fromAuth = displayNameFromAuthMetadata(user.user_metadata ?? null);
  const displayName = currentName || fromAuth || humanizeEmailLocalPart(email);

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function getProfilePhone(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("phone_e164")
    .eq("id", userId)
    .maybeSingle();

  return (data as { phone_e164?: string | null } | null)?.phone_e164 ?? null;
}

export async function getProfileDisplayName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return (data as { display_name?: string | null } | null)?.display_name ?? null;
}

/** Save preferred display name shown on tasks and family lists. */
export async function updateProfileDisplayName(formData: FormData) {
  const raw = String(formData.get("displayName") ?? "").trim();

  if (raw.length > 80) {
    return { error: "Name must be 80 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const displayName = raw || humanizeEmailLocalPart(user.email ?? "");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/family");
  revalidatePath("/calendar");
  return { success: true as const, displayName };
}

/** Save optional mobile for Reliant correlation (E.164). Empty clears. */
export async function updateProfilePhone(formData: FormData) {
  const raw = String(formData.get("phone") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  let phoneE164: string | null = null;
  if (raw) {
    phoneE164 = normalizeToE164(raw);
    if (!phoneE164) {
      return {
        error: "Enter a valid mobile number (e.g. +1 555 123 4567 or 555-123-4567).",
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      phone_e164: phoneE164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That phone number is already linked to another Hub account." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true as const, phoneE164 };
}
