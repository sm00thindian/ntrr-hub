import { encryptJson } from "@/lib/integrations/crypto";
import {
  fetchGoogleUserEmail,
  refreshGoogleAccessToken,
} from "@/lib/integrations/google/oauth";
import { GOOGLE_INTEGRATION_SCOPES } from "@/lib/integrations/google/scopes";
import type { GoogleTokenBundle, IntegrationAccount } from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";

export class GoogleApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function ensureGoogleAccessToken(
  account: IntegrationAccount,
): Promise<{ accessToken: string; account: IntegrationAccount }> {
  const tokens = account.metadata.tokens;
  if (!tokens?.refreshToken) {
    throw new Error("Google integration is missing refresh token. Reconnect Google.");
  }

  const expiresAt = new Date(tokens.expiresAt).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: tokens.accessToken, account };
  }

  const refreshed = await refreshGoogleAccessToken(tokens.refreshToken);
  const updatedTokens: GoogleTokenBundle = {
    accessToken: refreshed.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    connectedEmail: tokens.connectedEmail,
  };

  const metadata = {
    ...account.metadata,
    tokens: encryptJson(updatedTokens),
  };

  const admin = createAdminClient();
  await admin
    .from("integration_accounts")
    .update({ metadata, status: "connected", updated_at: new Date().toISOString() })
    .eq("id", account.id);

  return {
    accessToken: updatedTokens.accessToken,
    account: { ...account, metadata: { ...account.metadata, tokens: updatedTokens } },
  };
}

export async function googleFetch(
  account: IntegrationAccount,
  path: string,
  init?: RequestInit & { etag?: string },
) {
  const { accessToken } = await ensureGoogleAccessToken(account);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init?.etag) {
    headers.set("If-Match", init.etag);
  }

  const response = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GoogleApiError(body || response.statusText, response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function connectGoogleAccount(params: {
  householdId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** Space-separated scope string from Google token response, when present. */
  scope?: string;
}) {
  const connectedEmail = await fetchGoogleUserEmail(params.accessToken);
  const tokens: GoogleTokenBundle = {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresAt: new Date(Date.now() + params.expiresIn * 1000).toISOString(),
    connectedEmail,
  };

  const scopesFromToken = params.scope
    ?.split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const scopes =
    scopesFromToken?.length ? scopesFromToken : [...GOOGLE_INTEGRATION_SCOPES];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_accounts")
    .upsert(
      {
        household_id: params.householdId,
        provider: "google",
        status: "connected",
        scopes,
        metadata: {
          tokens: encryptJson(tokens),
          google: {},
        },
        created_by: params.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,provider,created_by" },
    )
    .select("id, household_id, provider, status, scopes, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save Google integration.");
  }

  return data;
}