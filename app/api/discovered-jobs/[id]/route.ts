import { scoreDiscoveredJobFit } from "@/lib/jobFitScorer";
import { prisma } from "@/lib/prisma";
import { DiscoveredJobStatus, WorkMode } from "@prisma/client";
import { NextResponse } from "next/server";

type UpdateBody = {
  companyName?: string;
  title?: string;
  location?: string | null;
  workMode?: "Remote" | "Hybrid" | "OnSite" | "Unknown" | null;
  jobUrl?: string;
  description?: string | null;
  status?: "new" | "saved" | "ignored" | "applied";
};

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeWorkMode(value: string | null | undefined) {
  if (!value) return null;
  if (value === WorkMode.Remote) return WorkMode.Remote;
  if (value === WorkMode.Hybrid) return WorkMode.Hybrid;
  if (value === WorkMode.OnSite) return WorkMode.OnSite;
  if (value === WorkMode.Unknown) return WorkMode.Unknown;
  return null;
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return null;
  if (value === DiscoveredJobStatus.new) return DiscoveredJobStatus.new;
  if (value === DiscoveredJobStatus.saved) return DiscoveredJobStatus.saved;
  if (value === DiscoveredJobStatus.ignored) return DiscoveredJobStatus.ignored;
  if (value === DiscoveredJobStatus.applied) return DiscoveredJobStatus.applied;
  return null;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const job = await prisma.discoveredJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Discovered job not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = (await request.json()) as UpdateBody;

  const existing = await prisma.discoveredJob.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Discovered job not found" }, { status: 404 });

  const companyName = body.companyName?.trim() || existing.companyName;
  const title = body.title?.trim() || existing.title;
  const jobUrl = body.jobUrl?.trim() || existing.jobUrl;
  const workMode = normalizeWorkMode(body.workMode ?? null) ?? existing.workMode;
  const status = normalizeStatus(body.status ?? null) ?? existing.status;
  const description = body.description?.trim() ?? existing.description;
  const location = body.location?.trim() ?? existing.location;

  const fit = scoreDiscoveredJobFit({
    companyName,
    title,
    description,
    location,
    workMode,
  });

  try {
    const updated = await prisma.discoveredJob.update({
      where: { id },
      data: {
        companyName,
        title,
        location,
        workMode,
        jobUrl,
        description,
        status,
        fitScore: fit.fitScore,
        fitReason: fit.fitReason,
      },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unique constraint") || message.includes("jobUrl")) {
      return NextResponse.json({ error: "This job has already been discovered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update discovered job" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await prisma.discoveredJob.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Discovered job not found" }, { status: 404 });
  }
}
