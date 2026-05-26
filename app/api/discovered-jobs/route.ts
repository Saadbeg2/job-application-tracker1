import { scoreDiscoveredJobFit } from "@/lib/jobFitScorer";
import { prisma } from "@/lib/prisma";
import { DiscoveredJobStatus, WorkMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { chicagoDateKeyToStoredDate, getTodayChicagoDateKey } from "@/lib/dates";

type CreateBody = {
  companyName?: string;
  title?: string;
  location?: string | null;
  workMode?: "Remote" | "Hybrid" | "OnSite" | "Unknown" | null;
  jobUrl?: string;
  description?: string | null;
};

function normalizeWorkMode(value: string | null | undefined) {
  if (!value) return WorkMode.Unknown;
  if (value === WorkMode.Remote) return WorkMode.Remote;
  if (value === WorkMode.Hybrid) return WorkMode.Hybrid;
  if (value === WorkMode.OnSite) return WorkMode.OnSite;
  if (value === WorkMode.Unknown) return WorkMode.Unknown;
  return null;
}

function normalizeStatus(value: string | null) {
  if (!value) return null;
  if (value === DiscoveredJobStatus.new) return DiscoveredJobStatus.new;
  if (value === DiscoveredJobStatus.saved) return DiscoveredJobStatus.saved;
  if (value === DiscoveredJobStatus.ignored) return DiscoveredJobStatus.ignored;
  if (value === DiscoveredJobStatus.applied) return DiscoveredJobStatus.applied;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = normalizeStatus(url.searchParams.get("status"));

  const jobs = await prisma.discoveredJob.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBody;

  const companyName = String(body.companyName ?? "").trim();
  const title = String(body.title ?? "").trim();
  const jobUrl = String(body.jobUrl ?? "").trim();

  if (!companyName || !title || !jobUrl) {
    return NextResponse.json({ error: "companyName, title, and jobUrl are required" }, { status: 400 });
  }

  const workMode = normalizeWorkMode(body.workMode ?? null);
  if (!workMode) {
    return NextResponse.json({ error: "Invalid workMode" }, { status: 400 });
  }

  const fit = scoreDiscoveredJobFit({
    companyName,
    title,
    description: body.description ?? null,
    location: body.location ?? null,
    workMode,
  });

  try {
    const created = await prisma.discoveredJob.create({
      data: {
        companyName,
        title,
        location: body.location?.trim() || null,
        workMode,
        jobUrl,
        description: body.description?.trim() || null,
        dateFound: chicagoDateKeyToStoredDate(getTodayChicagoDateKey()),
        fitScore: fit.fitScore,
        fitReason: fit.fitReason,
        status: DiscoveredJobStatus.new,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unique constraint") || message.includes("jobUrl")) {
      return NextResponse.json({ error: "This job has already been discovered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create discovered job" }, { status: 500 });
  }
}
