import { PageHeader } from "@/components/layout/page-header";
import { ConflictResolver } from "@/components/sync/conflict-resolver";
import { requireHouseholdContext } from "@/lib/households/context";
import { getPendingConflicts } from "@/lib/sync/conflict";

export default async function ConflictsPage() {
  const ctx = await requireHouseholdContext();
  const conflicts = await getPendingConflicts(ctx.householdId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync conflicts"
        description="Choose which version to keep when sources disagree"
      />

      <ConflictResolver
        conflicts={conflicts.map((row) => ({
          id: row.id as string,
          provider: row.provider as string,
          entityType: row.entity_type as string,
          entityId: row.entity_id as string,
          fieldName: row.field_name as string,
          localValue: row.local_value,
          remoteValue: row.remote_value,
          createdAt: row.created_at as string,
        }))}
      />
    </div>
  );
}