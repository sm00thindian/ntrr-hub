"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { RecurringTemplateForm } from "@/components/tasks/recurring-template-form";
import { KanbanColumn, TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { HouseholdMember } from "@/lib/households/queries";
import type { RecurringTaskTemplate, Task } from "@/lib/tasks/types";
import { KANBAN_STATUSES, TASK_STATUS_LABELS } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export type TaskFilter = "all" | "mine" | "overdue" | "unassigned";

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "overdue", label: "Overdue" },
  { id: "unassigned", label: "Unassigned" },
];

type TaskBoardProps = {
  householdId: string;
  currentUserId: string;
  tasks: Task[];
  templates: RecurringTaskTemplate[];
  members: HouseholdMember[];
  canEdit: boolean;
  /** Done/reopen without full edit (self-advocate). Defaults to canEdit. */
  canComplete?: boolean;
  timeZone: string;
  timeZoneLabel: string;
  /** Self-advocate: default Mine, simpler filters, no household templates */
  myDayMode?: boolean;
};

function filterTasks(tasks: Task[], filter: TaskFilter, currentUserId: string, nowMs: number) {
  switch (filter) {
    case "mine":
      return tasks.filter((t) => t.assigneeId === currentUserId);
    case "overdue":
      return tasks.filter(
        (t) =>
          t.status !== "done" &&
          t.dueAt &&
          Date.parse(t.dueAt) < nowMs,
      );
    case "unassigned":
      return tasks.filter((t) => t.status !== "done" && !t.assigneeId);
    default:
      return tasks;
  }
}

export function TaskBoard({
  householdId,
  currentUserId,
  tasks,
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
  const [showAdd, setShowAdd] = useState(false);
  const [, startRefresh] = useTransition();

  const visibleFilters = myDayMode
    ? FILTERS.filter((f) => f.id === "mine" || f.id === "overdue")
    : FILTERS;

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

  const filteredTasks = useMemo(
    () => filterTasks(tasks, filter, currentUserId, Date.now()),
    [tasks, filter, currentUserId],
  );

  const filterCounts = useMemo(() => {
    const nowMs = Date.now();
    const mine = tasks.filter((t) => t.assigneeId === currentUserId);
    const pool = myDayMode ? mine : tasks;
    return {
      all: tasks.length,
      mine: mine.length,
      overdue: pool.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      ).length,
      unassigned: tasks.filter((t) => t.status !== "done" && !t.assigneeId).length,
    } satisfies Record<TaskFilter, number>;
  }, [tasks, currentUserId, myDayMode]);

  // In My day mode, "overdue" only counts the member's tasks
  const scopedTasks = useMemo(() => {
    if (!myDayMode) {
      return tasks;
    }
    return tasks.filter((t) => t.assigneeId === currentUserId);
  }, [tasks, myDayMode, currentUserId]);

  const displayTasks = useMemo(() => {
    if (!myDayMode) {
      return filteredTasks;
    }
    if (filter === "overdue") {
      const nowMs = Date.now();
      return scopedTasks.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      );
    }
    // mine (default) — already scoped
    return scopedTasks;
  }, [myDayMode, filter, filteredTasks, scopedTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {displayTasks.length}
          {!myDayMode && filter !== "all" ? ` of ${tasks.length}` : ""} active task
          {displayTasks.length === 1 ? "" : "s"}
          {!myDayMode && templates.length
            ? ` · ${templates.length} recurring template${templates.length === 1 ? "" : "s"}`
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
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter tasks"
      >
        {visibleFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
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
      </div>

      {canEdit && showAdd ? (
        <div className={cn("grid gap-4", !myDayMode && "xl:grid-cols-2")}>
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
              tasks={displayTasks}
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
        <ul className="space-y-3">
          {displayTasks.map((task) => (
            <li key={task.id} className="touch-pan-y">
              <TaskCard
                task={task}
                canEdit={canEdit}
                canComplete={allowComplete}
                timeZone={timeZone}
                timeZoneLabel={timeZoneLabel}
                members={members}
                onUpdated={refresh}
              />
            </li>
          ))}
          {!displayTasks.length ? (
            <li className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {myDayMode
                ? "No tasks assigned to you yet."
                : filter === "all"
                  ? "No tasks yet. Add one to get your household coordinated."
                  : "No tasks match this filter."}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
