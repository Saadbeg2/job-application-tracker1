import { applicationStatuses } from "@/lib/constants";
import { parseDateInputToStoredDateInChicago } from "@/lib/dates";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ApplicationRow = {
  id: number;
  company: string;
  role: string;
  dateApplied: Date;
  lastFollowedUpAt: Date | null;
  lastFollowedUpWith: string | null;
  lastFollowUpNotes: string | null;
  followUpCount: number;
  status: ApplicationStatus;
  interviewStatus: string | null;
  interviewDate: Date | null;
  interviewWith: string | null;
  interviewNotes: string | null;
  source: string | null;
  jobLink: string | null;
  resumeUsed: string | null;
  notes: string | null;
  jobDescription: string | null;
  location: string | null;
  referral: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDateTime(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return parsed;
}

async function selectApplicationById(id: number) {
  const rows = await prisma.$queryRaw<ApplicationRow[]>`
    SELECT
      "id",
      "company",
      "role",
      "dateApplied",
      "lastFollowedUpAt",
      "lastFollowedUpWith",
      "lastFollowUpNotes",
      "followUpCount",
      "status",
      "interviewStatus",
      "interviewDate",
      "interviewWith",
      "interviewNotes",
      "source",
      "jobLink",
      "resumeUsed",
      "notes",
      "jobDescription",
      "location",
      "referral",
      "createdAt",
      "updatedAt"
    FROM "Application"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function updateInterviewFields(id: number, body: Record<string, unknown>) {
  const interviewDate = parseOptionalDateTime(body.interviewDate);

  await prisma.$executeRaw`
    UPDATE "Application"
    SET
      "interviewStatus" = ${optionalText(body.interviewStatus)},
      "interviewDate" = ${interviewDate},
      "interviewWith" = ${optionalText(body.interviewWith)},
      "interviewNotes" = ${optionalText(body.interviewNotes)}
    WHERE "id" = ${id}
  `;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const application = await selectApplicationById(id);
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

  const required = ["company", "role", "dateApplied"];
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

  let dateApplied: Date;
  try {
    dateApplied = parseDateInputToStoredDateInChicago(String(body.dateApplied));
  } catch {
    return NextResponse.json({ error: "Invalid dateApplied" }, { status: 400 });
  }

  try {
    parseOptionalDateTime(body.interviewDate);
  } catch {
    return NextResponse.json({ error: "Invalid interviewDate" }, { status: 400 });
  }

  try {
    await prisma.application.update({
      where: { id },
      data: {
        company: String(body.company),
        role: String(body.role),
        dateApplied,
        status,
        source: body.source || null,
        jobLink: body.jobLink?.trim() || null,
        resumeUsed: body.resumeUsed || null,
        notes: body.notes || null,
        jobDescription: body.jobDescription || null,
        location: body.location || null,
        referral: body.referral || null,
      },
    });

    await updateInterviewFields(id, body);

    return NextResponse.json(await selectApplicationById(id));
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
