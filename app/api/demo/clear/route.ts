import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DEMO_EMAIL_SUBJECTS, DEMO_SOURCES } from "@/lib/demoData";

export async function POST() {
  try {
    const demoSubjects = Object.values(DEMO_EMAIL_SUBJECTS);

    const [reviewItems, tasksBySource, tasksBySubject, applicationsBySource, applicationsByDemoBackfill] =
      await prisma.$transaction([
        prisma.reviewItem.deleteMany({
          where: {
            OR: [
              { source: DEMO_SOURCES.gmail },
              { emailSubject: { in: demoSubjects } },
            ],
          },
        }),
        prisma.task.deleteMany({
          where: {
            sourceEmailSubject: DEMO_SOURCES.gmail,
          },
        }),
        prisma.task.deleteMany({
          where: {
            sourceEmailSubject: { in: demoSubjects },
            company: { in: ["Amazon"] },
          },
        }),
        prisma.application.deleteMany({
          where: {
            source: { in: [DEMO_SOURCES.application, DEMO_SOURCES.gmail] },
          },
        }),
        prisma.application.deleteMany({
          where: {
            source: "Gmail Backfill",
            company: "Nagarro",
            role: "Software Engineer",
            notes: "Created from Gmail status update review item",
          },
        }),
      ]);

    return NextResponse.json({
      ok: true,
      removed: {
        reviewItems: reviewItems.count,
        tasks: tasksBySource.count + tasksBySubject.count,
        applications: applicationsBySource.count + applicationsByDemoBackfill.count,
      },
      message: "Demo data cleared. Real data was not targeted.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to clear demo data: ${message}` }, { status: 500 });
  }
}
