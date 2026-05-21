import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [applications, totalApplications, pendingTasks, recentApplications] =
    await Promise.all([
      prisma.application.findMany({
        select: { id: true, company: true, dateApplied: true },
      }),
      prisma.application.count(),
      prisma.task.count({ where: { status: "pending" } }),
      prisma.application.findMany({
        orderBy: { dateApplied: "desc" },
        take: 5,
      }),
    ]);
  const { applicationsToday, applicationsThisWeek } = countApplicationsForTodayAndWeek(applications);

  return NextResponse.json({
    applicationsToday,
    applicationsThisWeek,
    totalApplications,
    pendingTasks,
    recentApplications,
  });
}
