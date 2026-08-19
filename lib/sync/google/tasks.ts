import { GoogleApiError, googleFetch } from "@/lib/integrations/google/client";
import type { IntegrationAccount } from "@/lib/integrations/types";
import {
  provenanceAfterInboundUpdate,
  provenanceAfterOutboundMirror,
  provenanceFromRemoteImport,
  taskLooksHubOriginated,
  type Provenance,
} from "@/lib/provenance/types";
import { recordSyncConflict } from "@/lib/sync/conflict";
import {
  googleDueToIso,
  googleTaskStatusToNtrr,
  ntrrDueToGoogle,
  ntrrTaskStatusToGoogle,
} from "@/lib/sync/mappers";
import type { TaskStatus } from "@/lib/tasks/types";
import { createAdminClient } from "@/lib/supabase/admin";

type GoogleTask = {
  id: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  etag?: string;
  updated?: string;
};

async function getDefaultTaskListId(account: IntegrationAccount) {
  const cached = account.metadata.google?.defaultTaskListId;
  if (cached) {
    return cached;
  }

  const lists = (await googleFetch(account, "/tasks/v1/users/@me/lists")) as {
    items?: Array<{ id: string }>;
  };

  const listId = lists.items?.[0]?.id ?? "@default";

  const admin = createAdminClient();
  await admin
    .from("integration_accounts")
    .update({
      metadata: {
        ...account.metadata,
        google: { ...account.metadata.google, defaultTaskListId: listId },
      },
    })
    .eq("id", account.id);

  return listId;
}

export async function pullGoogleTasks(account: IntegrationAccount) {
  const admin = createAdminClient();
  const householdId = account.householdId;

  const { data: integrationRow } = await admin
    .from("integration_accounts")
    .select("created_by")
    .eq("id", account.id)
    .maybeSingle();

  const createdBy = integrationRow?.created_by as string | undefined;
  const listId = await getDefaultTaskListId(account);
  const syncToken = account.metadata.google?.tasksSyncToken;

  const path = syncToken
    ? `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showDeleted=true&showHidden=true&syncToken=${encodeURIComponent(syncToken)}`
    : `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&maxResults=100`;

  let payload: {
    items?: GoogleTask[];
    nextSyncToken?: string;
  };

  try {
    payload = (await googleFetch(account, path)) as typeof payload;
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 410) {
      await admin
        .from("integration_accounts")
        .update({
          metadata: {
            ...account.metadata,
            google: { ...account.metadata.google, tasksSyncToken: undefined },
          },
        })
        .eq("id", account.id);
      return pullGoogleTasks({ ...account, metadata: { ...account.metadata, google: { ...account.metadata.google, tasksSyncToken: undefined } } });
    }
    throw error;
  }

  for (const item of payload.items ?? []) {
    if (!item.id) {
      continue;
    }

    const { data: mapping } = await admin
      .from("sync_mappings")
      .select("id, ntrr_id, external_etag")
      .eq("household_id", householdId)
      .eq("provider", "google")
      .eq("entity_type", "task")
      .eq("external_id", item.id)
      .maybeSingle();

    if (item.status === "deleted") {
      if (mapping?.ntrr_id) {
        const { data: localTask } = await admin
          .from("tasks")
          .select("provenance")
          .eq("id", mapping.ntrr_id)
          .maybeSingle();
        const existing = (localTask as { provenance?: Provenance } | null)?.provenance;
        await admin
          .from("tasks")
          .update({
            status: "cancelled",
            provenance: provenanceAfterInboundUpdate(existing, {
              externalId: item.id,
              remoteSource: "google",
            }),
          })
          .eq("id", mapping.ntrr_id);
      }
      continue;
    }

    const remoteUpdatedAt = item.updated ? new Date(item.updated).toISOString() : null;
    const title = item.title ?? "Untitled task";
    const status = googleTaskStatusToNtrr(item.status);
    const dueAt = googleDueToIso(item.due);

    if (mapping?.ntrr_id) {
      const { data: localTask } = await admin
        .from("tasks")
        .select(
          "title, status, due_at, updated_at, provenance, assignee_id, reliant_confirm_requested, reliant_sms_reminder_requested, recurring_template_id",
        )
        .eq("id", mapping.ntrr_id)
        .maybeSingle();

      const local = localTask as {
        title: string;
        status: string;
        due_at: string | null;
        updated_at: string;
        provenance?: Provenance;
        assignee_id?: string | null;
        reliant_confirm_requested?: boolean | null;
        reliant_sms_reminder_requested?: boolean | null;
        recurring_template_id?: string | null;
      } | null;

      const remoteUpdatedMs = item.updated ? new Date(item.updated).getTime() : 0;
      const localUpdatedMs = local ? new Date(local.updated_at).getTime() : 0;
      // Hub won: do not let a slower Google pull undo a local Done (common race after complete).
      if (local && localUpdatedMs > remoteUpdatedMs) {
        if (
          mapping.external_etag &&
          item.etag &&
          mapping.external_etag !== item.etag
        ) {
          if (local.title !== title) {
            await recordSyncConflict({
              householdId,
              provider: "google",
              entityType: "task",
              entityId: mapping.ntrr_id,
              fieldName: "title",
              localValue: local.title,
              remoteValue: title,
            });
          }
          if (local.status !== status) {
            await recordSyncConflict({
              householdId,
              provider: "google",
              entityType: "task",
              entityId: mapping.ntrr_id,
              fieldName: "status",
              localValue: local.status,
              remoteValue: status,
            });
          }
        }
        continue;
      }

      const existing = local?.provenance;
      const preferNtrrOrigin = taskLooksHubOriginated({
        provenance: existing,
        assignee_id: local?.assignee_id,
        reliant_confirm_requested: local?.reliant_confirm_requested,
        reliant_sms_reminder_requested: local?.reliant_sms_reminder_requested,
        recurring_template_id: local?.recurring_template_id,
      });

      await admin
        .from("tasks")
        .update({
          title,
          description: item.notes ?? null,
          status,
          due_at: dueAt,
          provenance: provenanceAfterInboundUpdate(existing, {
            externalId: item.id,
            remoteSource: "google",
            preferNtrrOrigin,
          }),
        })
        .eq("id", mapping.ntrr_id);

      await admin
        .from("sync_mappings")
        .update({
          external_etag: item.etag ?? null,
          external_updated_at: remoteUpdatedAt,
        })
        .eq("id", mapping.id);
    } else {
      if (!createdBy) {
        continue;
      }

      const { data: created } = await admin
        .from("tasks")
        .insert({
          household_id: householdId,
          title,
          description: item.notes ?? null,
          status,
          due_at: dueAt,
          provenance: provenanceFromRemoteImport("google", item.id),
          created_by: createdBy,
        })
        .select("id")
        .single();

      if (created?.id) {
        await admin.from("sync_mappings").insert({
          household_id: householdId,
          provider: "google",
          entity_type: "task",
          ntrr_id: created.id,
          external_id: item.id,
          external_etag: item.etag ?? null,
          external_updated_at: remoteUpdatedAt,
        });
      }
    }
  }

  if (payload.nextSyncToken) {
    await admin
      .from("integration_accounts")
      .update({
        metadata: {
          ...account.metadata,
          google: { ...account.metadata.google, tasksSyncToken: payload.nextSyncToken },
        },
      })
      .eq("id", account.id);
  }
}

export async function pushGoogleTask(
  account: IntegrationAccount,
  entry: {
    entityId: string;
    operation: "create" | "update" | "delete";
    payload: Record<string, unknown>;
  },
) {
  const admin = createAdminClient();
  const householdId = account.householdId;
  const listId = await getDefaultTaskListId(account);

  const { data: mapping } = await admin
    .from("sync_mappings")
    .select("id, external_id, external_etag")
    .eq("household_id", householdId)
    .eq("provider", "google")
    .eq("entity_type", "task")
    .eq("ntrr_id", entry.entityId)
    .maybeSingle();

  if (entry.operation === "delete") {
    if (!mapping?.external_id) {
      return;
    }

    try {
      await googleFetch(
        account,
        `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(mapping.external_id)}`,
        { method: "DELETE", etag: mapping.external_etag ?? undefined },
      );
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 412) {
        await recordSyncConflict({
          householdId,
          provider: "google",
          entityType: "task",
          entityId: entry.entityId,
          fieldName: "delete",
          localValue: { deleted: true },
          remoteValue: { deleted: false },
        });
      } else {
        throw error;
      }
    }
    return;
  }

  const title = String(entry.payload.title ?? "Untitled task");
  const status = ntrrTaskStatusToGoogle((entry.payload.status as TaskStatus) ?? "todo");
  const due = ntrrDueToGoogle((entry.payload.dueAt as string | null) ?? null);

  const body: Record<string, unknown> = {
    title,
    status,
    notes: entry.payload.description ?? undefined,
    due,
  };

  if (mapping?.external_id) {
    try {
      const updated = (await googleFetch(
        account,
        `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(mapping.external_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          etag: mapping.external_etag ?? undefined,
        },
      )) as GoogleTask;

      await admin
        .from("sync_mappings")
        .update({
          external_etag: updated.etag ?? null,
          external_updated_at: updated.updated ? new Date(updated.updated).toISOString() : null,
        })
        .eq("id", mapping.id);

      // Hub edits push outbound — restore origin chip if a past bug rewrote it to Google.
      const { data: localTask } = await admin
        .from("tasks")
        .select(
          "provenance, assignee_id, reliant_confirm_requested, reliant_sms_reminder_requested, recurring_template_id",
        )
        .eq("id", entry.entityId)
        .maybeSingle();
      const row = localTask as {
        provenance?: Provenance;
        assignee_id?: string | null;
        reliant_confirm_requested?: boolean | null;
        reliant_sms_reminder_requested?: boolean | null;
        recurring_template_id?: string | null;
      } | null;
      if (row) {
        await admin
          .from("tasks")
          .update({
            provenance: provenanceAfterOutboundMirror(row.provenance, mapping.external_id),
          })
          .eq("id", entry.entityId);
      }
    } catch (error) {
      if (error instanceof GoogleApiError && (error.status === 412 || error.status === 409)) {
        await recordSyncConflict({
          householdId,
          provider: "google",
          entityType: "task",
          entityId: entry.entityId,
          fieldName: "title",
          localValue: title,
          remoteValue: "Remote copy changed on Google",
        });
      } else {
        throw error;
      }
    }
    return;
  }

  const created = (await googleFetch(
    account,
    `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )) as GoogleTask;

  if (!created.id) {
    return;
  }

  await admin.from("sync_mappings").upsert(
    {
      household_id: householdId,
      provider: "google",
      entity_type: "task",
      ntrr_id: entry.entityId,
      external_id: created.id,
      external_etag: created.etag ?? null,
      external_updated_at: created.updated ? new Date(created.updated).toISOString() : null,
    },
    { onConflict: "household_id,provider,entity_type,ntrr_id" },
  );

  // Keep Hub origin for family-created tasks; only attach Google external id.
  const { data: localTask } = await admin
    .from("tasks")
    .select("provenance")
    .eq("id", entry.entityId)
    .maybeSingle();
  const existing = (localTask as { provenance?: Provenance } | null)?.provenance;

  await admin
    .from("tasks")
    .update({
      provenance: provenanceAfterOutboundMirror(existing, created.id),
    })
    .eq("id", entry.entityId);
}