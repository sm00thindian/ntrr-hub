"use server";

import { revalidatePath } from "next/cache";

import { normalizeToE164 } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function upsertProfile(user: { id: string; email?: string | null }) {
  if (!user.email) {
    return;
  }

  const supabase = await createClient();

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email.toLowerCase(),
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