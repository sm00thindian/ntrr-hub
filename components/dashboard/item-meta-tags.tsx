import { AssigneeChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import type { HouseholdPersona } from "@/lib/permissions/roles";
import type { ProvenanceSource } from "@/lib/provenance/types";
import { cn } from "@/lib/utils";

/**
 * Fixed-width meta columns so assignee + source chips line up vertically
 * across Focus and Today's agenda rows (predictable for scan/OCD-friendly layout).
 *
 * Column order (right side of row): [assignee 7.5rem] [source 4rem]
 * Events leave the assignee column empty so source still sits in the same place.
 */
export function ItemMetaTags({
  source,
  showAssignee,
  assigneeLabel,
  assigneePersona,
  className,
}: {
  source: ProvenanceSource;
  /** Tasks show assignee / Unassigned; events keep the column for alignment */
  showAssignee: boolean;
  assigneeLabel?: string | null;
  assigneePersona?: HouseholdPersona | string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5",
        className,
      )}
      aria-label="Item source and assignment"
    >
      <div className="flex h-6 w-[7.5rem] shrink-0 items-center justify-end overflow-hidden">
        {showAssignee ? (
          <AssigneeChip
            label={assigneeLabel}
            persona={assigneePersona}
            unassigned={!assigneeLabel}
            className="max-w-full"
          />
        ) : (
          <span className="invisible select-none text-xs" aria-hidden="true">
            —
          </span>
        )}
      </div>
      <div className="flex h-6 w-[4rem] shrink-0 items-center justify-end overflow-hidden">
        <SourceChip source={source} className="max-w-full" />
      </div>
    </div>
  );
}
