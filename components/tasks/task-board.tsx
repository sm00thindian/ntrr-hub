"use client";

import { useEffect, useState, useTransition } from "react";
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

type TaskBoardProps = {
  householdId: string;
  tasks: Task[];
  templates: RecurringTaskTemplate[];
  members: HouseholdMember[];
  canEdit: boolean;
  timeZone: string;
  timeZoneLabel: string;
};

export function TaskBoard({
  householdId,
  tasks,
  templates,
  members,
  canEdit,
  timeZone,
  timeZoneLabel,
}: TaskBoardProps) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("list");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tasks.length} active task{tasks.length === 1 ? "" : "s"}
          {templates.length ? ` · ${templates.length} recurring template${templates.length === 1 ? "" : "s"}` : ""}
        </p>
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

      {canEdit ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <CreateTaskForm
            members={members}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            onCreated={refresh}
          />
          <RecurringTemplateForm members={members} onCreated={refresh} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You have view-only access to the task board.</p>
      )}

      {view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              title={TASK_STATUS_LABELS[status]}
              status={status}
              tasks={tasks}
              canEdit={canEdit}
              timeZone={timeZone}
              onUpdated={refresh}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "touch-pan-y",
                canEdit && "sm:cursor-default",
              )}
            >
              <TaskCard
                task={task}
                canEdit={canEdit}
                timeZone={timeZone}
                onUpdated={refresh}
              />
            </li>
          ))}
          {!tasks.length ? (
            <li className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks yet. Add one above to get your household coordinated.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}