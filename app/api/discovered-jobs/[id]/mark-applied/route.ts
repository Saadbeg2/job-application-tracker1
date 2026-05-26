import { chicagoDateKeyToStoredDate, getTodayChicagoDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus, DiscoveredJobStatus } from "@prisma/client";
import { NextResponse } from "next/server";

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const job = await prisma.discoveredJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Discovered job not found" }, { status: 404 });

  const existing = await prisma.application.findFirst({
    where: {
      company: job.companyName,
      role: job.title,
      jobLink: job.jobUrl,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.discoveredJob.update({
      where: { id },
      data: { status: DiscoveredJobStatus.applied },
    });
    return NextResponse.json({
      ok: true,
      message: "Application already exists for this discovered job.",
      applicationId: existing.id,
      alreadyExisted: true,
    });
  }

  const dateApplied = chicagoDateKeyToStoredDate(getTodayChicagoDateKey());

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        company: job.companyName,
        role: job.title,
        dateApplied,
        status: ApplicationStatus.Applied,
        source: "Job Discovery",
        jobLink: job.jobUrl,
        location: job.location,
        notes: "Created from Job Discovery",
      },
    });

    const discoveredJob = await tx.discoveredJob.update({
      where: { id },
      data: { status: DiscoveredJobStatus.applied },
    });

    return { application, discoveredJob };
  });

  return NextResponse.json({
    ok: true,
    message: "Application created from discovered job.",
    application: result.application,
    discoveredJob: result.discoveredJob,
  });
}
