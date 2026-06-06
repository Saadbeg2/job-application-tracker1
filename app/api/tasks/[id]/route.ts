import { taskStatuses } from "@/lib/constants";
import { isFollowUpTask } from "@/lib/followUpTasks";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateStatus(status: string | undefined) {
  if (!status) return TaskStatus.pending;
  return taskStatuses.includes(status as (typeof taskStatuses)[number])
    ? (status as TaskStatus)
    : null;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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

  const followedUpWith = String(body.followedUpWith ?? "").trim();
  const followUpNotes = String(body.followUpNotes ?? "").trim();

  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const becameCompleted = existing.status !== TaskStatus.completed && status === TaskStatus.completed;
    const isLinkedFollowUpCompletion =
      becameCompleted &&
      Boolean(existing.applicationId) &&
      isFollowUpTask(existing.sourceEmailSubject);

    if (isLinkedFollowUpCompletion && !followedUpWith) {
      return NextResponse.json(
        { error: "Who you followed up with is required to complete this follow-up task." },
        { status: 400 },
      );
    }

    const task = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
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

      if (becameCompleted && updatedTask.applicationId && isFollowUpTask(updatedTask.sourceEmailSubject)) {
        await tx.application.update({
          where: { id: updatedTask.applicationId },
          data: {
            lastFollowedUpAt: new Date(),
            lastFollowedUpWith: followedUpWith,
            lastFollowUpNotes: followUpNotes || null,
            followUpCount: { increment: 1 },
          },
        });
      }

      return updatedTask;
    });

    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await prisma.task.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
}
