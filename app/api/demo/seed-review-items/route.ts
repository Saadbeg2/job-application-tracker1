import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { demoReviewItemsSeedData } from "@/lib/demoData";
import { requireDemoMode } from "@/lib/demoMode";

export async function POST() {
  try {
    requireDemoMode();

    const now = new Date();
    const demoItems = demoReviewItemsSeedData(now);

    const subjects = demoItems.map((item) => item.emailSubject);
    const existing = await prisma.reviewItem.findMany({
      where: {
        reviewStatus: "pending",
        emailSubject: { in: subjects },
      },
      select: { emailSubject: true },
    });

    const existingSubjects = new Set(existing.map((item) => item.emailSubject).filter((value): value is string => Boolean(value)));
    const itemsToCreate = demoItems.filter((item) => !item.emailSubject || !existingSubjects.has(item.emailSubject));

    if (itemsToCreate.length > 0) {
      await prisma.reviewItem.createMany({ data: itemsToCreate });
    }

    return NextResponse.json({
      ok: true,
      created: itemsToCreate.length,
      skipped: demoItems.length - itemsToCreate.length,
      message:
        itemsToCreate.length === 0
          ? "Demo review items are already present in pending queue."
          : "Demo review items loaded successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "DEMO_MODE_REQUIRED") {
      return NextResponse.json({ error: "Demo data endpoints require DEMO_MODE=true." }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to load demo review items: ${message}` }, { status: 500 });
  }
}
