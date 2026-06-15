import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { dateOnlyKeyFromStoredDate, getTodayChicagoDateKey } from "@/lib/dates";
import { getConfiguredGoogleSheetUrl } from "@/lib/dailyReport";
import { isDemoMode } from "@/lib/demoMode";
import { ApplicationStatus, PrismaClient, TaskStatus } from "@prisma/client";

type InterviewPipelineRow = {
  id: number;
  company: string;
  role: string;
  interviewStatus: string | null;
  interviewDate: Date | null;
  interviewWith: string | null;
  interviewNotes: string | null;
};

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

  const [applications, statusGroups, activeTasksCount, followUpDueCount, syncConfig, interviewApplications] = await Promise.all([
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
    prisma.$queryRaw<InterviewPipelineRow[]>`
      SELECT
        "id",
        "company",
        "role",
        "interviewStatus",
        "interviewDate",
        "interviewWith",
        "interviewNotes"
      FROM "Application"
      WHERE "status" = 'Interview'
      ORDER BY "interviewDate" ASC NULLS LAST, "updatedAt" DESC
    `,
  ]);

  const { applicationsToday, applicationsThisWeek } = countApplicationsForTodayAndWeek(applications);
  const statusCounts = emptyStatusCounts();

  for (const group of statusGroups) {
    statusCounts[group.status] = group._count.status;
  }

  const applicationsYesterday = applications.filter(
    (application) => dateOnlyKeyFromStoredDate(application.dateApplied) === yesterdayKey,
  ).length;

  const completedOrWaitingStatuses = new Set(["Completed", "Waiting for next steps"]);
  const interviewPipeline = {
    counts: {
      inInterviewProcess: interviewApplications.length,
      scheduledInterviews: interviewApplications.filter((application) => application.interviewDate).length,
      pendingOrScreening: interviewApplications.filter(
        (application) =>
          !application.interviewDate &&
          !completedOrWaitingStatuses.has(application.interviewStatus ?? ""),
      ).length,
      completedOrWaiting: interviewApplications.filter((application) =>
        completedOrWaitingStatuses.has(application.interviewStatus ?? ""),
      ).length,
    },
    applications: interviewApplications.map((application) => ({
      id: application.id,
      company: application.company,
      role: application.role,
      interviewStatus: application.interviewStatus,
      interviewDate: application.interviewDate?.toISOString() ?? null,
      interviewWith: application.interviewWith,
      interviewNotes: application.interviewNotes,
    })),
  };

  return {
    totalApplications: applications.length,
    applicationsToday,
    applicationsYesterday,
    applicationsThisWeek,
    statusCounts,
    activeTasksCount,
    followUpDueCount,
    interviewPipeline,
    googleSheetUrl: isDemoMode() ? null : getConfiguredGoogleSheetUrl(syncConfig?.spreadsheetUrl ?? null),
  };
}
