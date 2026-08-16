import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { connectGoogleAccount } from "@/lib/integrations/google/client";
import { exchangeGoogleCode } from "@/lib/integrations/google/oauth";
import { runHouseholdSync } from "@/lib/sync/orchestrator";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/settings?error=${oauthError}`, siteUrl));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  const contextRaw = cookieStore.get("google_oauth_context")?.value;

  cookieStore.delete("google_oauth_state");
  cookieStore.delete("google_oauth_context");

  if (!code || !state || !expectedState || state !== expectedState || !contextRaw) {
    return NextResponse.redirect(new URL("/settings?error=invalid_state", siteUrl));
  }

  const context = JSON.parse(contextRaw) as { householdId: string; userId: string };
  const redirectUri = `${siteUrl}/api/integrations/google/callback`;

  try {
    const tokens = await exchangeGoogleCode(code, redirectUri);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/settings?error=missing_refresh_token", siteUrl));
    }

    await connectGoogleAccount({
      householdId: context.householdId,
      userId: context.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    });

    await runHouseholdSync(context.householdId);

    return NextResponse.redirect(new URL("/settings?connected=google", siteUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "connect_failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(message)}`, siteUrl),
    );
  }
}