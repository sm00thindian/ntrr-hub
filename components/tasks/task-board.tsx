"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, List } from "lucide-react";

import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { RecurringTemplateForm } from "@/components/tasks/recurring-template-form";
import { KanbanColumn, TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { memberDisplayLabel } from "@/lib/households/member-label";
import type { HouseholdMember } from "@/lib/households/queries";
import type { TaskBoardSections } from "@/lib/tasks/queries";
import type { RecurringTaskTemplate, Task } from "@/lib/tasks/types";
import { KANBAN_STATUSES, TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export type TaskFilter = "all" | "mine" | "overdue" | "unassigned";

/** "all" = any assignee; otherwise a member user id */
export type AssigneeFilterId = "all" | string;

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "overdue", label: "Overdue" },
  { id: "unassigned", label: "Unassigned" },
];

type TaskBoardProps = {
  householdId: string;
  currentUserId: string;
  /** Pre-partitioned board sections from the server */
  sections: TaskBoardSections;
  templates: RecurringTaskTemplate[];
  members: HouseholdMember[];
  canEdit: boolean;
  canComplete?: boolean;
  timeZone: string;
  timeZoneLabel: string;
  myDayMode?: boolean;
};

function filterByAssignee(tasks: Task[], assigneeFilter: AssigneeFilterId) {
  if (assigneeFilter === "all") {
    return tasks;
  }
  return tasks.filter((t) => t.assigneeId === assigneeFilter);
}

function applyTaskFilter(
  tasks: Task[],
  filter: TaskFilter,
  currentUserId: string,
  nowMs: number,
) {
  switch (filter) {
    case "mine":
      return tasks.filter((t) => t.assigneeId === currentUserId);
    case "overdue":
      return tasks.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      );
    case "unassigned":
      return tasks.filter((t) => t.status !== "done" && !t.assigneeId);
    default:
      return tasks;
  }
}

function filterSection(
  tasks: Task[],
  filter: TaskFilter,
  assigneeFilter: AssigneeFilterId,
  currentUserId: string,
  myDayMode: boolean,
  nowMs: number,
) {
  let list = tasks;
  if (myDayMode) {
    list = list.filter((t) => t.assigneeId === currentUserId);
    if (filter === "overdue") {
      return list.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      );
    }
    return list;
  }
  list = applyTaskFilter(list, filter, currentUserId, nowMs);
  if (filter === "mine" || filter === "unassigned") {
    return list;
  }
  return filterByAssignee(list, assigneeFilter);
}

function SectionHeader({
  id,
  title,
  description,
  count,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: string;
  count: number;
  tone?: "default" | "danger" | "muted";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
      <div className="min-w-0">
        <h2
          id={id}
          className={cn(
            "text-sm font-semibold tracking-tight",
            tone === "danger" && "text-destructive",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </div>
  );
}

function TaskSection({
  id,
  title,
  description,
  tasks,
  tone,
  canEdit,
  canComplete,
  timeZone,
  timeZoneLabel,
  members,
  onUpdated,
  emptyHint,
}: {
  id: string;
  title: string;
  description?: string;
  tasks: Task[];
  tone?: "default" | "danger" | "muted";
  canEdit: boolean;
  canComplete: boolean;
  timeZone: string;
  timeZoneLabel: string;
  members: HouseholdMember[];
  onUpdated: () => void;
  emptyHint?: string;
}) {
  if (!tasks.length && !emptyHint) {
    return null;
  }

  return (
    <section aria-labelledby={id} className="space-y-3">
      <SectionHeader
        id={id}
        title={title}
        description={description}
        count={tasks.length}
        tone={tone}
      />
      {tasks.length ? (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.id} className="touch-pan-y">
              <TaskCard
                task={task}
                canEdit={canEdit}
                canComplete={canComplete}
                timeZone={timeZone}
                timeZoneLabel={timeZoneLabel}
                members={members}
                onUpdated={onUpdated}
              />
            </li>
          ))}
        </ul>
      ) : emptyHint ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
          {emptyHint}
        </p>
      ) : null}
    </section>
  );
}

function CollapsibleTaskSection({
  id,
  title,
  description,
  tasks,
  defaultOpen,
  tone = "muted",
  canEdit,
  canComplete,
  timeZone,
  timeZoneLabel,
  members,
  onUpdated,
}: {
  id: string;
  title: string;
  description?: string;
  tasks: Task[];
  defaultOpen: boolean;
  tone?: "default" | "danger" | "muted";
  canEdit: boolean;
  canComplete: boolean;
  timeZone: string;
  timeZoneLabel: string;
  members: HouseholdMember[];
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!tasks.length) {
    return null;
  }

  return (
    <section aria-labelledby={id} className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-left",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <div className="min-w-0">
          <h2
            id={id}
            className={cn(
              "text-sm font-semibold",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {title}
          </h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          ) : null}
        </div>
        <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs tabular-nums">
          {tasks.length}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <ul id={`${id}-panel`} className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.id} className="touch-pan-y">
              <TaskCard
                task={task}
                canEdit={canEdit}
                canComplete={canComplete}
                timeZone={timeZone}
                timeZoneLabel={timeZoneLabel}
                members={members}
                onUpdated={onUpdated}
                compact
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function TaskBoard({
  householdId,
  currentUserId,
  sections,
  templates,
  members,
  canEdit,
  canComplete,
  timeZone,
  timeZoneLabel,
  myDayMode = false,
}: TaskBoardProps) {
  const allowComplete = canComplete ?? canEdit;
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("list");
  const [filter, setFilter] = useState<TaskFilter>(myDayMode ? "mine" : "all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilterId>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [, startRefresh] = useTransition();
  const nowMs = Date.now();

  const visibleFilters = myDayMode
    ? FILTERS.filter((f) => f.id === "mine" || f.id === "overdue")
    : FILTERS;

  const allTasks = useMemo(
    () => [
      ...sections.overdue,
      ...sections.today,
      ...sections.upcoming,
      ...sections.doneToday,
      ...sections.history,
    ],
    [sections],
  );

  const activeTasks = useMemo(
    () => [...sections.overdue, ...sections.today, ...sections.upcoming],
    [sections],
  );

  const assigneeOptions = useMemo(() => {
    return members.map((m) => ({
      id: m.userId,
      label: memberDisplayLabel(m.email, m.displayName),
      count: allTasks.filter((t) => t.assigneeId === m.userId).length,
    }));
  }, [members, allTasks]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`tasks:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          startRefresh(() => router.refresh());
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, router]);

  const refresh = () => startRefresh(() => router.refresh());

  const filteredSections = useMemo(() => {
    const args = [filter, assigneeFilter, currentUserId, myDayMode, nowMs] as const;
    return {
      overdue: filterSection(sections.overdue, ...args),
      today: filterSection(sections.today, ...args),
      upcoming: filterSection(sections.upcoming, ...args),
      doneToday: filterSection(sections.doneToday, ...args),
      history: filterSection(sections.history, ...args),
    };
  }, [sections, filter, assigneeFilter, currentUserId, myDayMode, nowMs]);

  const displayActive = useMemo(
    () => [
      ...filteredSections.overdue,
      ...filteredSections.today,
      ...filteredSections.upcoming,
    ],
    [filteredSections],
  );

  const displayForKanban = useMemo(
    () => [...displayActive, ...filteredSections.doneToday],
    [displayActive, filteredSections.doneToday],
  );

  const filterCounts = useMemo(() => {
    const mine = activeTasks.filter((t) => t.assigneeId === currentUserId);
    const pool = myDayMode ? mine : activeTasks;
    const scoped =
      !myDayMode && assigneeFilter !== "all" && filter !== "mine" && filter !== "unassigned"
        ? filterByAssignee(activeTasks, assigneeFilter)
        : pool;
    return {
      all: scoped.length,
      mine: mine.length,
      overdue: scoped.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      ).length,
      unassigned: activeTasks.filter((t) => t.status !== "done" && !t.assigneeId).length,
    } satisfies Record<TaskFilter, number>;
  }, [activeTasks, currentUserId, myDayMode, assigneeFilter, filter, nowMs]);

  const activeCount =
    filteredSections.overdue.length +
    filteredSections.today.length +
    filteredSections.upcoming.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium tabular-nums">{activeCount}</span> open
          {filteredSections.doneToday.length
            ? ` · ${filteredSections.doneToday.length} done today`
            : ""}
          {filteredSections.history.length
            ? ` · ${filteredSections.history.length} in history`
            : ""}
          {!myDayMode && templates.length
            ? ` · ${templates.length} recurring series`
            : ""}
          {myDayMode ? " · assigned to you" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant={showAdd ? "outline" : "default"}
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? "Hide form" : "Add task"}
            </Button>
          ) : null}
          <div className="flex rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "kanban" ? "default" : "ghost"}
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Board</span>
            </Button>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Filter tasks"
      >
        {visibleFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => {
              setFilter(item.id);
              if (item.id === "mine" || item.id === "unassigned") {
                setAssigneeFilter("all");
              }
            }}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                filter === item.id ? "bg-background/20" : "bg-muted",
              )}
            >
              {filterCounts[item.id]}
            </span>
          </button>
        ))}

        {!myDayMode && members.length > 0 ? (
          <label className="inline-flex h-9 items-center gap-1.5">
            <span className="sr-only">Assigned to</span>
            <select
              value={assigneeFilter}
              disabled={filter === "mine" || filter === "unassigned"}
              aria-label="Filter by assignee"
              onChange={(event) => {
                const next = event.target.value as AssigneeFilterId;
                setAssigneeFilter(next);
                if (next !== "all" && (filter === "mine" || filter === "unassigned")) {
                  setFilter("all");
                }
              }}
              className={cn(
                "border-input bg-background h-9 max-w-[12rem] rounded-full border px-3 text-xs font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                assigneeFilter !== "all" &&
                  filter !== "mine" &&
                  filter !== "unassigned"
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <option value="all">Assigned to: Anyone</option>
              {assigneeOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label} ({person.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {canEdit && showAdd ? (
        <div
          className={cn(
            "grid gap-4",
            !myDayMode && "md:grid-cols-2",
          )}
        >
          <CreateTaskForm
            members={members}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            defaultAssigneeId={myDayMode ? currentUserId : ""}
            onCreated={() => {
              refresh();
              setShowAdd(false);
            }}
          />
          {!myDayMode ? (
            <RecurringTemplateForm
              members={members}
              timeZoneLabel={timeZoneLabel}
              onCreated={refresh}
            />
          ) : null}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">You have view-only access to the task board.</p>
      ) : null}

      {view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              title={TASK_STATUS_LABELS[status]}
              status={status}
              tasks={displayForKanban}
              canEdit={canEdit}
              canComplete={allowComplete}
              timeZone={timeZone}
              timeZoneLabel={timeZoneLabel}
              members={members}
              onUpdated={refresh}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <TaskSection
            id="tasks-overdue"
            title="Needs attention"
            description="Past due — clear these first."
            tasks={filteredSections.overdue}
            tone="danger"
            canEdit={canEdit}
            canComplete={allowComplete}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            members={members}
            onUpdated={refresh}
          />
          <TaskSection
            id="tasks-today"
            title="Today"
            description="Due today, or no due date yet."
            tasks={filteredSections.today}
            canEdit={canEdit}
            canComplete={allowComplete}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            members={members}
            onUpdated={refresh}
            emptyHint={
              !filteredSections.overdue.length &&
              !filteredSections.upcoming.length &&
              !filteredSections.doneToday.length
                ? myDayMode
                  ? "Nothing on your plate for today."
                  : "Nothing due today."
                : undefined
            }
          />
          <TaskSection
            id="tasks-upcoming"
            title="Upcoming"
            description="Due later — including the next run of Daily / Weekly / Monthly series."
            tasks={filteredSections.upcoming}
            canEdit={canEdit}
            canComplete={allowComplete}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            members={members}
            onUpdated={refresh}
          />

          {!activeCount &&
          !filteredSections.doneToday.length &&
          !filteredSections.history.length ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {myDayMode
                ? "No tasks assigned to you yet."
                : filter === "all" && assigneeFilter === "all"
                  ? "No tasks yet. Add one to get your household coordinated."
                  : "No tasks match this filter."}
            </p>
          ) : null}

          <CollapsibleTaskSection
            id="tasks-done-today"
            title="Done today"
            description="Finished during this household day. Recurring series will open again next cycle."
            tasks={filteredSections.doneToday}
            defaultOpen
            canEdit={canEdit}
            canComplete={allowComplete}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            members={members}
            onUpdated={refresh}
          />

          <CollapsibleTaskSection
            id="tasks-history"
            title="History"
            description="One-off tasks finished before today. Recurring history stays with each series, not here."
            tasks={filteredSections.history}
            defaultOpen={false}
            canEdit={canEdit}
            canComplete={allowComplete}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            members={members}
            onUpdated={refresh}
          />
        </div>
      )}
    </div>
  );
}
