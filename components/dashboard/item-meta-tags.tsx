import { AssigneeChip } from "@/components/family/role-badge";
import { SourceChip } from "@/components/provenance/source-chip";
import type { HouseholdPersona } from "@/lib/permissions/roles";
import type { ProvenanceSource } from "@/lib/provenance/types";
import { cn } from "@/lib/utils";

/**
 * Fixed-width meta columns so assignee + source chips line up on Today's agenda.
 * Focus uses assignee inline (left of title) and omits source — Hub tasks are NTRR.
 *
 * Column order (right side of row): [assignee 7.5rem] [source 4rem]
 * Events leave the assignee column empty so source still sits in the same place.
 */
export function ItemMetaTags({
  source,
  showAssignee,
  showSource = true,
  assigneeLabel,
  assigneePersona,
  memberColor,
  className,
}: {
  source: ProvenanceSource;
  /** Tasks show assignee / Unassigned; events keep the column for alignment */
  showAssignee: boolean;
  /** Agenda keeps source chips; Focus can hide them */
  showSource?: boolean;
  assigneeLabel?: string | null;
  assigneePersona?: HouseholdPersona | string | null;
  /** Household member color for assignee chip accent */
  memberColor?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5",
        className,
      )}
      aria-label={showSource ? "Item source and assignment" : "Assignment"}
    >
      <div className="flex h-6 w-[7.5rem] shrink-0 items-center justify-end overflow-hidden">
        {showAssignee ? (
          <AssigneeChip
            label={assigneeLabel}
            persona={assigneePersona}
            memberColor={memberColor}
            unassigned={!assigneeLabel}
            className="max-w-full"
          />
        ) : (
          <span className="invisible select-none text-xs" aria-hidden="true">
            —
          </span>
        )}
      </div>
      {showSource ? (
        <div className="flex h-6 w-[4rem] shrink-0 items-center justify-end overflow-hidden">
          <SourceChip source={source} className="max-w-full" />
        </div>
      ) : null}
    </div>
  );
}
