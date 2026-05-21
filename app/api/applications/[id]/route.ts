import { applicationStatuses } from "@/lib/constants";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateStatus(status: string | undefined) {
  if (!status) return ApplicationStatus.Applied;
  return applicationStatuses.includes(status as (typeof applicationStatuses)[number])
    ? (status as ApplicationStatus)
    : null;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json();

  const required = ["company", "role", "dateApplied", "jobLink"];
  const missing = required.filter((field) => !body?.[field]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const status = validateStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const application = await prisma.application.update({
      where: { id },
      data: {
        company: String(body.company),
        role: String(body.role),
        dateApplied: new Date(body.dateApplied),
        status,
        source: body.source || null,
        jobLink: String(body.jobLink),
        resumeUsed: body.resumeUsed || null,
        notes: body.notes || null,
        jobDescription: body.jobDescription || null,
        location: body.location || null,
        referral: body.referral || null,
      },
    });

    return NextResponse.json(application);
  } catch {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await prisma.application.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
}
