import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ApplicationStatus } from "@prisma/client";
import { DEMO_SOURCES, yesterdayInChicagoDate } from "@/lib/demoData";
import { requireDemoMode } from "@/lib/demoMode";

export async function POST() {
  try {
    requireDemoMode();

    const existing = await prisma.application.findFirst({
      where: {
        source: DEMO_SOURCES.application,
        company: "Agoda",
        role: "Data Analyst",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        created: false,
        message: "Demo Agoda application already exists.",
        applicationId: existing.id,
      });
    }

    const application = await prisma.application.create({
      data: {
        company: "Agoda",
        role: "Data Analyst",
        dateApplied: yesterdayInChicagoDate(),
        status: ApplicationStatus.Applied,
        source: DEMO_SOURCES.application,
        jobLink: null,
      },
    });

    return NextResponse.json({
      ok: true,
      created: true,
      message: "Demo existing Agoda application created.",
      applicationId: application.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "DEMO_MODE_REQUIRED") {
      return NextResponse.json({ error: "Demo data endpoints require DEMO_MODE=true." }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to seed demo existing application: ${message}` }, { status: 500 });
  }
}
