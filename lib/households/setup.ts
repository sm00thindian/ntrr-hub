import { getHouseholdCalendarSettings } from "@/lib/households/calendar-settings";
import { getHouseholdMembers, getPendingInvites } from "@/lib/households/queries";
import { getHouseholdIntegration } from "@/lib/integrations/queries";
import { getHouseholdTasks } from "@/lib/tasks/queries";

export type SetupStepId = "timezone" | "invite" | "connect_or_tasks";

export type SetupStep = {
  id: SetupStepId;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export type HouseholdSetupStatus = {
  complete: boolean;
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
};

/**
 * Lightweight post-household checklist for first-session orientation.
 * Completes when invite OR calendar OR enough native tasks exist (plus timezone set is soft).
 */
export async function getHouseholdSetupStatus(
  householdId: string,
): Promise<HouseholdSetupStatus> {
  const [settings, members, invites, google, apple, tasks] = await Promise.all([
    getHouseholdCalendarSettings(householdId),
    getHouseholdMembers(householdId),
    getPendingInvites(householdId),
    getHouseholdIntegration(householdId, "google"),
    getHouseholdIntegration(householdId, "apple_caldav"),
    getHouseholdTasks(householdId),
  ]);

  const timezoneDone = Boolean(settings.timezone?.trim());
  const inviteDone = members.length > 1 || invites.length > 0;
  const calendarConnected =
    google?.status === "connected" || apple?.status === "connected";
  const hasTasks = tasks.filter((t) => t.status !== "done").length >= 1;
  const connectOrTasksDone = calendarConnected || hasTasks;

  const steps: SetupStep[] = [
    {
      id: "timezone",
      title: "Confirm household timezone",
      description: timezoneDone
        ? "Due times and the day board use this zone."
        : "Open Settings and tap Confirm timezone (even if the default already looks right).",
      href: "/settings#household-timezone",
      done: timezoneDone,
    },
    {
      id: "invite",
      title: "Invite someone",
      description: "Add a partner, sibling, or care partner to the board.",
      href: "/family",
      done: inviteDone,
    },
    {
      id: "connect_or_tasks",
      title: "Connect a calendar or add tasks",
      description: "Pull schedule context, or start with Hub tasks only.",
      href: calendarConnected || !hasTasks ? "/settings" : "/tasks",
      done: connectOrTasksDone,
    },
  ];

  // Prefer tasks link when calendar not connected and user might add tasks
  if (!calendarConnected) {
    const step = steps.find((s) => s.id === "connect_or_tasks");
    if (step) {
      step.href = hasTasks ? "/settings" : "/tasks";
    }
  }

  const completedCount = steps.filter((s) => s.done).length;

  return {
    complete: steps.every((s) => s.done),
    steps,
    completedCount,
    totalCount: steps.length,
  };
}
