import { taskStatuses } from "@/lib/constants";
import { ensureFollowUpTasks } from "@/lib/followUpTasks";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function validateStatus(status: string | undefined) {
  if (!status) return TaskStatus.pending;
  return taskStatuses.includes(status as (typeof taskStatuses)[number])
    ? (status as TaskStatus)
    : null;
}

export async function GET() {
  await ensureFollowUpTasks(prisma);

  const tasks = await prisma.task.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const body = await request.json();

  const required = ["company", "title", "sourceEmailSubject"];
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

  const task = await prisma.task.create({
    data: {
      applicationId: body.applicationId ? Number(body.applicationId) : null,
      company: String(body.company),
      role: body.role || null,
      title: String(body.title),
      status,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sourceEmailSubject: String(body.sourceEmailSubject),
      notes: body.notes || null,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
