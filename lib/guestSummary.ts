import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { dateOnlyKeyFromStoredDate, getTodayChicagoDateKey } from "@/lib/dates";
import { getConfiguredGoogleSheetUrl } from "@/lib/dailyReport";
import { ApplicationStatus, PrismaClient, TaskStatus } from "@prisma/client";

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function emptyStatusCounts(): Record<ApplicationStatus, number> {
  return {
    [ApplicationStatus.Applied]: 0,
    [ApplicationStatus.Interview]: 0,
    [ApplicationStatus.Rejected]: 0,
    [ApplicationStatus.Offer]: 0,
    [ApplicationStatus.Withdrawn]: 0,
  };
}

export async function getGuestDashboardSummary(prisma: PrismaClient) {
  const todayKey = getTodayChicagoDateKey();
  const yesterdayKey = previousDateKey(todayKey);

  const [applications, statusGroups, activeTasksCount, followUpDueCount, syncConfig] = await Promise.all([
    prisma.application.findMany({
      select: { id: true, company: true, dateApplied: true },
    }),
    prisma.application.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.task.count({ where: { status: TaskStatus.pending } }),
    prisma.task.count({
      where: {
        status: TaskStatus.pending,
        sourceEmailSubject: "Auto Follow-Up",
        applicationId: { not: null },
      },
    }),
    prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const { applicationsToday, applicationsThisWeek } = countApplicationsForTodayAndWeek(applications);
  const statusCounts = emptyStatusCounts();

  for (const group of statusGroups) {
    statusCounts[group.status] = group._count.status;
  }

  const applicationsYesterday = applications.filter(
    (application) => dateOnlyKeyFromStoredDate(application.dateApplied) === yesterdayKey,
  ).length;

  return {
    totalApplications: applications.length,
    applicationsToday,
    applicationsYesterday,
    applicationsThisWeek,
    statusCounts,
    activeTasksCount,
    followUpDueCount,
    googleSheetUrl: getConfiguredGoogleSheetUrl(syncConfig?.spreadsheetUrl ?? null),
  };
}
