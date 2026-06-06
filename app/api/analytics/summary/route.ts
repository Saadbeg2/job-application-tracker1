import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { ensureFollowUpTasks } from "@/lib/followUpTasks";
import { ReviewItemType, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  await ensureFollowUpTasks(prisma);

  const [applications, totalApplications, pendingTasks, pendingReviewItems, pendingStatusUpdates, pendingReviewTasks, lastScan, recentApplications] =
    await Promise.all([
      prisma.application.findMany({
        select: { id: true, company: true, dateApplied: true },
      }),
      prisma.application.count(),
      prisma.task.count({ where: { status: "pending" } }),
      prisma.reviewItem.count({ where: { reviewStatus: ReviewStatus.pending } }),
      prisma.reviewItem.count({
        where: { reviewStatus: ReviewStatus.pending, type: ReviewItemType.status_update },
      }),
      prisma.reviewItem.count({
        where: { reviewStatus: ReviewStatus.pending, type: ReviewItemType.task },
      }),
      prisma.scanHistory.findFirst({ orderBy: { scanEndedAt: "desc" } }),
      prisma.application.findMany({
        orderBy: [{ dateApplied: "desc" }, { createdAt: "desc" }, { updatedAt: "desc" }],
        take: 5,
      }),
    ]);
  const { applicationsToday, applicationsThisWeek } = countApplicationsForTodayAndWeek(applications);

  return NextResponse.json({
    applicationsToday,
    applicationsThisWeek,
    totalApplications,
    pendingTasks,
    pendingReviewItems,
    pendingStatusUpdates,
    pendingReviewTasks,
    lastGmailScanAt: lastScan?.scanEndedAt ?? null,
    recentApplications,
  });
}
