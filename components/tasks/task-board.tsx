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
  timeZone: string;
  timeZoneLabel: string;
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
  timeZone,
  timeZoneLabel,
}: TaskBoardProps) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("list");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [, startRefresh] = useTransition();

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
    return {
      all: tasks.length,
      mine: tasks.filter((t) => t.assigneeId === currentUserId).length,
      overdue: tasks.filter(
        (t) => t.status !== "done" && t.dueAt && Date.parse(t.dueAt) < nowMs,
      ).length,
      unassigned: tasks.filter((t) => t.status !== "done" && !t.assigneeId).length,
    } satisfies Record<TaskFilter, number>;
  }, [tasks, currentUserId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filteredTasks.length}
          {filter !== "all" ? ` of ${tasks.length}` : ""} active task
          {filteredTasks.length === 1 ? "" : "s"}
          {templates.length
            ? ` · ${templates.length} recurring template${templates.length === 1 ? "" : "s"}`
            : ""}
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
        {FILTERS.map((item) => (
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
        <div className="grid gap-4 xl:grid-cols-2">
          <CreateTaskForm
            members={members}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            onCreated={() => {
              refresh();
              setShowAdd(false);
            }}
          />
          <RecurringTemplateForm
            members={members}
            timeZoneLabel={timeZoneLabel}
            onCreated={refresh}
          />
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
              tasks={filteredTasks}
              canEdit={canEdit}
              timeZone={timeZone}
              timeZoneLabel={timeZoneLabel}
              members={members}
              onUpdated={refresh}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredTasks.map((task) => (
            <li key={task.id} className="touch-pan-y">
              <TaskCard
                task={task}
                canEdit={canEdit}
                timeZone={timeZone}
                timeZoneLabel={timeZoneLabel}
                members={members}
                onUpdated={refresh}
              />
            </li>
          ))}
          {!filteredTasks.length ? (
            <li className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {filter === "all"
                ? "No tasks yet. Add one to get your household coordinated."
                : "No tasks match this filter."}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
