export type ProvenanceSource = "ntrr" | "google" | "microsoft" | "apple_caldav" | "zapier";

export type ProvenanceConfidence = "high" | "medium" | "low";

export type ProvenanceModifier = "user" | "sync" | "ai";

/**
 * Provenance for Hub entities.
 * `source` / `originSource` = where the row was born (UI chips).
 * Sync may set `externalId` / `syncedAt` without rewriting Hub origin to Google.
 */
export type Provenance = {
  source: ProvenanceSource;
  /**
   * Immutable birth place when known. Prefer over `source` for chips after
   * older sync bugs rewrote `source` to the provider.
   */
  originSource?: ProvenanceSource;
  externalId?: string;
  calendarId?: string;
  calendarName?: string;
  syncedAt: string;
  confidence: ProvenanceConfidence;
  lastModifiedBy: ProvenanceModifier;
};

/** After mirroring a Hub-created entity outbound — keep origin, attach external id. */
export function provenanceAfterOutboundMirror(
  existing: Provenance | null | undefined,
  externalId: string,
): Provenance {
  const origin = existing?.originSource ?? existing?.source ?? "ntrr";
  return {
    source: origin,
    originSource: origin,
    externalId,
    calendarId: existing?.calendarId,
    calendarName: existing?.calendarName,
    syncedAt: new Date().toISOString(),
    confidence: existing?.confidence ?? "high",
    lastModifiedBy: "sync",
  };
}

/**
 * Hub-only fields mean the task was created/managed in the family board even if
 * a buggy outbound sync rewrote provenance.source to "google".
 */
export function taskLooksHubOriginated(task: {
  provenance?: Provenance | null;
  assigneeId?: string | null;
  assignee_id?: string | null;
  reliantConfirmRequested?: boolean | null;
  reliant_confirm_requested?: boolean | null;
  reliantSmsReminderRequested?: boolean | null;
  reliant_sms_reminder_requested?: boolean | null;
  recurringTemplateId?: string | null;
  recurring_template_id?: string | null;
}): boolean {
  if (task.provenance?.originSource === "ntrr" || task.provenance?.source === "ntrr") {
    return true;
  }
  if (task.assigneeId || task.assignee_id) {
    return true;
  }
  if (task.reliantConfirmRequested || task.reliant_confirm_requested) {
    return true;
  }
  if (task.reliantSmsReminderRequested || task.reliant_sms_reminder_requested) {
    return true;
  }
  if (task.recurringTemplateId || task.recurring_template_id) {
    return true;
  }
  return false;
}

/** Chip / agenda source: origin, with repair for Hub-native tasks mislabeled by sync. */
export function displayProvenanceSource(
  provenance: Provenance | null | undefined,
  taskHints?: Parameters<typeof taskLooksHubOriginated>[0],
): ProvenanceSource {
  if (provenance?.originSource) {
    return provenance.originSource;
  }
  if (taskHints && taskLooksHubOriginated({ ...taskHints, provenance })) {
    return "ntrr";
  }
  return provenance?.source ?? "ntrr";
}

/**
 * After inbound provider update of an already-mapped entity.
 * Preserves Hub origin so agenda/task chips stay "ntrr" for family-created work.
 */
export function provenanceAfterInboundUpdate(
  existing: Provenance | null | undefined,
  params: {
    externalId: string;
    remoteSource: ProvenanceSource;
    /** When true, force origin back to ntrr (Hub-only fields present). */
    preferNtrrOrigin?: boolean;
  },
): Provenance {
  const origin: ProvenanceSource = params.preferNtrrOrigin
    ? "ntrr"
    : existing?.originSource === "ntrr" || existing?.source === "ntrr"
      ? "ntrr"
      : (existing?.originSource ?? existing?.source ?? params.remoteSource);

  return {
    source: origin,
    originSource: existing?.originSource ?? origin,
    externalId: params.externalId,
    calendarId: existing?.calendarId,
    calendarName: existing?.calendarName,
    syncedAt: new Date().toISOString(),
    confidence: "high",
    lastModifiedBy: "sync",
  };
}

/** Brand-new row imported from a provider (no prior Hub origin). */
export function provenanceFromRemoteImport(
  remoteSource: ProvenanceSource,
  externalId: string,
  extra?: Partial<Pick<Provenance, "calendarId" | "calendarName">>,
): Provenance {
  return {
    source: remoteSource,
    originSource: remoteSource,
    externalId,
    calendarId: extra?.calendarId,
    calendarName: extra?.calendarName,
    syncedAt: new Date().toISOString(),
    confidence: "high",
    lastModifiedBy: "sync",
  };
}