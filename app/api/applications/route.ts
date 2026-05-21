import { applicationStatuses } from "@/lib/constants";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function validateStatus(status: string | undefined) {
  if (!status) return ApplicationStatus.Applied;
  return applicationStatuses.includes(status as (typeof applicationStatuses)[number])
    ? (status as ApplicationStatus)
    : null;
}

export async function GET() {
  const applications = await prisma.application.findMany({
    orderBy: { dateApplied: "desc" },
  });

  return NextResponse.json(applications);
}

export async function POST(request: Request) {
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

  const application = await prisma.application.create({
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

  return NextResponse.json(application, { status: 201 });
}
