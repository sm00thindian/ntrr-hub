import { decryptJson } from "@/lib/integrations/crypto";
import type { GoogleTokenBundle, IntegrationAccount, IntegrationMetadata } from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type IntegrationRow = {
  id: string;
  household_id: string;
  provider: IntegrationAccount["provider"];
  status: IntegrationAccount["status"];
  scopes: string[] | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapIntegration(row: IntegrationRow): IntegrationAccount {
  const metadata = { ...(row.metadata ?? {}) } as IntegrationMetadata;
  let status = row.status;

  // Never throw from decrypt during page render — broken/rotated keys would
  // otherwise white-screen the whole authenticated shell.
  if (typeof metadata.tokens === "string") {
    try {
      metadata.tokens = decryptJson<GoogleTokenBundle>(metadata.tokens);
    } catch {
      delete metadata.tokens;
      if (status === "connected") {
        status = "error";
      }
    }
  }

  const appleCreds = metadata.apple?.credentials as unknown;
  if (typeof appleCreds === "string") {
    try {
      const credentials = decryptJson<
        NonNullable<NonNullable<IntegrationMetadata["apple"]>["credentials"]>
      >(appleCreds);
      metadata.apple = {
        ...metadata.apple,
        credentials,
      };
    } catch {
      if (metadata.apple) {
        delete metadata.apple.credentials;
      }
      if (status === "connected") {
        status = "error";
      }
    }
  }

  return {
    id: row.id,
    householdId: row.household_id,
    provider: row.provider,
    status,
    scopes: row.scopes,
    metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  "id, household_id, provider, status, scopes, metadata, created_by, created_at, updated_at";

/** This member's integration for a provider (one Google/Apple per user per household). */
export async function getMemberIntegration(
  householdId: string,
  provider: IntegrationAccount["provider"],
  userId: string,
): Promise<IntegrationAccount | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integration_accounts")
    .select(SELECT_COLS)
    .eq("household_id", householdId)
    .eq("provider", provider)
    .eq("created_by", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapIntegration(data as IntegrationRow);
}

/**
 * @deprecated Prefer getMemberIntegration — kept for call sites that still mean
 * "any household Google". Returns the first connected account, or any row.
 */
export async function getHouseholdIntegration(
  householdId: string,
  provider: IntegrationAccount["provider"],
): Promise<IntegrationAccount | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integration_accounts")
    .select(SELECT_COLS)
    .eq("household_id", householdId)
    .eq("provider", provider)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapIntegration(data as IntegrationRow);
}

export async function getConnectedGoogleIntegration(
  householdId: string,
): Promise<IntegrationAccount | null> {
  const account = await getHouseholdIntegration(householdId, "google");
  if (!account || account.status !== "connected" || !account.metadata.tokens) {
    return null;
  }
  return account;
}

export async function getConnectedMemberGoogleIntegration(
  householdId: string,
  userId: string,
): Promise<IntegrationAccount | null> {
  const account = await getMemberIntegration(householdId, "google", userId);
  if (!account || account.status !== "connected" || !account.metadata.tokens) {
    return null;
  }
  return account;
}

export async function getConnectedAppleCalDavIntegrationAdmin(
  householdId: string,
): Promise<IntegrationAccount | null> {
  const accounts = await getAllConnectedAppleIntegrationsAdmin(householdId);
  return accounts[0] ?? null;
}

export async function getAllConnectedGoogleIntegrationsAdmin(
  householdId: string,
): Promise<IntegrationAccount[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("integration_accounts")
    .select(SELECT_COLS)
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("status", "connected");

  if (error || !data?.length) {
    return [];
  }

  return data
    .map((row) => mapIntegration(row as IntegrationRow))
    .filter((account) => Boolean(account.metadata.tokens));
}

export async function getAllConnectedAppleIntegrationsAdmin(
  householdId: string,
): Promise<IntegrationAccount[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("integration_accounts")
    .select(SELECT_COLS)
    .eq("household_id", householdId)
    .eq("provider", "apple_caldav")
    .eq("status", "connected");

  if (error || !data?.length) {
    return [];
  }

  return data
    .map((row) => mapIntegration(row as IntegrationRow))
    .filter((account) => Boolean(account.metadata.apple?.credentials));
}

export async function getConnectedGoogleIntegrationAdmin(
  householdId: string,
): Promise<IntegrationAccount | null> {
  const accounts = await getAllConnectedGoogleIntegrationsAdmin(householdId);
  return accounts[0] ?? null;
}

export async function getConnectedGoogleIntegrationAdminForUser(
  householdId: string,
  userId: string,
): Promise<IntegrationAccount | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("integration_accounts")
    .select(SELECT_COLS)
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("created_by", userId)
    .eq("status", "connected")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const account = mapIntegration(data as IntegrationRow);
  if (!account.metadata.tokens) {
    return null;
  }
  return account;
}
