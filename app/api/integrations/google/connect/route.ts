import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGoogleConnectUrl } from "@/lib/integrations/google/oauth";
import { isGoogleConfigured } from "@/lib/integrations/google/scopes";
import { canConnectCalendars, type HouseholdPersona, type HouseholdRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));
  }

  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id, role, persona")
    .eq("user_id", user.id)
    .limit(1);

  const membership = memberships?.[0] as
    | { household_id: string; role: HouseholdRole; persona: HouseholdPersona | null }
    | undefined;

  if (
    !membership ||
    !canConnectCalendars(membership.role, membership.persona ?? undefined)
  ) {
    return NextResponse.redirect(new URL("/settings?error=permission", process.env.NEXT_PUBLIC_SITE_URL));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  cookieStore.set(
    "google_oauth_context",
    JSON.stringify({ householdId: membership.household_id, userId: user.id }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    },
  );

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/google/callback`;
  const url = buildGoogleConnectUrl(state, redirectUri);

  return NextResponse.redirect(url);
}