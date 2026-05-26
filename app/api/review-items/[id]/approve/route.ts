import { ApplicationStatus, ReviewItemType, ReviewStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnlyKey, normalizeApplicationStatus, normalizeReviewType, roleSimilarityScore } from "@/lib/review";
import { NextResponse } from "next/server";
import { dateToChicagoStoredDate, parseDateInputToStoredDateInChicago } from "@/lib/dates";

type ApprovePayload = {
  type?: string;
  company?: string;
  role?: string;
  location?: string;
  suggestedStatus?: string;
  taskTitle?: string;
  source?: string;
  emailSubject?: string;
  emailReceivedAt?: string;
  matchedApplicationId?: number;
  forceApprove?: boolean;
  createMissingApplication?: boolean;
};

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

function extractLocationFromReviewItem(extractedDataJson: string | null) {
  if (!extractedDataJson) return null;
  try {
    const parsed = JSON.parse(extractedDataJson) as Record<string, unknown>;
    const candidate = parsed.location;
    if (typeof candidate !== "string") return null;
    const cleaned = candidate.trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

function extractJobLinkFromReviewItem(extractedDataJson: string | null) {
  if (!extractedDataJson) return null;
  try {
    const parsed = JSON.parse(extractedDataJson) as Record<string, unknown>;
    const candidate = parsed.jobLink ?? parsed.jobUrl ?? parsed.applicationUrl;
    if (typeof candidate !== "string" || !candidate.trim()) return null;
    const value = candidate.trim();
    if (!/^https?:\/\//i.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

async function duplicateCandidates(company: string, role: string | null, dateApplied: Date) {
  const all = await prisma.application.findMany({ orderBy: { dateApplied: "desc" } });
  const sameCompany = all.filter(
    (application) => application.company.trim().toLowerCase() === company.trim().toLowerCase(),
  );

  const incomingKey = dateOnlyKey(dateApplied);
  return sameCompany.filter((application) => {
    const existingKey = dateOnlyKey(application.dateApplied);
    const sameDay = existingKey === incomingKey;
    const roleScore = roleSimilarityScore(role, application.role);
    return sameDay && roleScore > 0;
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as ApprovePayload;

    const reviewItem = await prisma.reviewItem.findUnique({ where: { id } });
    if (!reviewItem) return NextResponse.json({ error: "Review item not found" }, { status: 404 });

    const effectiveType = normalizeReviewType(body.type) ?? reviewItem.type;
    const company = (body.company ?? reviewItem.company).trim();
    const role = (body.role ?? reviewItem.role ?? "").trim() || null;
    const location =
      (body.location ?? reviewItem.location ?? extractLocationFromReviewItem(reviewItem.extractedDataJson) ?? "").trim() ||
      null;
    const source = (body.source ?? reviewItem.source ?? "Gmail").trim() || "Gmail";
    const suggestedStatus =
      normalizeApplicationStatus(body.suggestedStatus ?? reviewItem.suggestedStatus ?? undefined) ??
      ApplicationStatus.Applied;
    const taskTitle = (body.taskTitle ?? reviewItem.taskTitle ?? "").trim();
    const emailSubject = (body.emailSubject ?? reviewItem.emailSubject ?? "").trim() || "manual";
    const emailReceivedAt = body.emailReceivedAt
      ? parseDateInputToStoredDateInChicago(body.emailReceivedAt)
      : reviewItem.emailReceivedAt
        ? dateToChicagoStoredDate(reviewItem.emailReceivedAt)
        : dateToChicagoStoredDate(new Date());

    if (!company) {
      return NextResponse.json({ error: "company is required" }, { status: 400 });
    }

    if (effectiveType === ReviewItemType.new_application) {
      if (!role) return NextResponse.json({ error: "role is required" }, { status: 400 });

      const dateApplied = emailReceivedAt;
      const duplicates = await duplicateCandidates(company, role, dateApplied);
      if (duplicates.length > 0 && !body.forceApprove) {
        return NextResponse.json(
          {
            error: "Possible duplicate application detected",
            requiresConfirmation: true,
            duplicates,
          },
          { status: 409 },
        );
      }

      const createdApplication = await prisma.$transaction(async (tx) => {
        const extractedJobLink = extractJobLinkFromReviewItem(reviewItem.extractedDataJson);
        const app = await tx.application.create({
          data: {
            company,
            role,
            location,
            dateApplied,
            status: ApplicationStatus.Applied,
            source,
            jobLink: extractedJobLink,
          },
        });

        return tx.reviewItem.update({
          where: { id },
          data: {
            type: effectiveType,
            company,
            role,
            location,
            source,
            reviewStatus: ReviewStatus.approved,
            matchedApplicationId: app.id,
          },
        }).then((updatedReviewItem) => ({ app, updatedReviewItem }));
      });

      return NextResponse.json({
        ok: true,
        reviewItem: createdApplication.updatedReviewItem,
        createdApplication: createdApplication.app,
      });
    }

    if (effectiveType === ReviewItemType.task) {
      if (!taskTitle) return NextResponse.json({ error: "taskTitle is required" }, { status: 400 });

      const createdTask = await prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            applicationId: body.matchedApplicationId ?? reviewItem.matchedApplicationId ?? null,
            company,
            role,
            title: taskTitle,
            status: TaskStatus.pending,
            sourceEmailSubject: emailSubject,
          },
        });

        return tx.reviewItem.update({
          where: { id },
          data: {
            type: effectiveType,
            company,
            role,
            location,
            taskTitle,
            reviewStatus: ReviewStatus.approved,
            matchedApplicationId: body.matchedApplicationId ?? reviewItem.matchedApplicationId ?? null,
          },
        }).then((updatedReviewItem) => ({ task, updatedReviewItem }));
      });

      return NextResponse.json({
        ok: true,
        reviewItem: createdTask.updatedReviewItem,
        createdTask: createdTask.task,
      });
    }

    if (effectiveType === ReviewItemType.status_update) {
      const selectedApplicationId = body.matchedApplicationId ?? reviewItem.matchedApplicationId;
      const createMissingApplication = Boolean(body.createMissingApplication);

      if (!selectedApplicationId && !createMissingApplication) {
        return NextResponse.json(
          { error: "Select an existing application or choose Create missing application." },
          { status: 400 },
        );
      }

      if (createMissingApplication) {
        if (!company || !role) {
          return NextResponse.json(
            { error: "Company and role are required when creating a missing application." },
            { status: 400 },
          );
        }

        const created = await prisma.$transaction(async (tx) => {
          const createdApplication = await tx.application.create({
            data: {
              company,
              role,
              location,
              status: suggestedStatus,
              dateApplied: emailReceivedAt,
              source: "Gmail Backfill",
              jobLink: null,
              notes: "Created from Gmail status update review item",
            },
          });

          const updatedReviewItem = await tx.reviewItem.update({
            where: { id },
            data: {
              type: effectiveType,
              company,
              role,
              location,
              suggestedStatus,
              matchedApplicationId: createdApplication.id,
              reviewStatus: ReviewStatus.approved,
            },
          });
          return { createdApplication, updatedReviewItem };
        });

        return NextResponse.json({
          ok: true,
          reviewItem: created.updatedReviewItem,
          createdApplication: created.createdApplication,
        });
      }

      const selectedId = selectedApplicationId as number;
      const application = await prisma.application.findUnique({ where: { id: selectedId } });
      if (!application) {
        return NextResponse.json({ error: "Selected application not found" }, { status: 404 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedApplication = await tx.application.update({
          where: { id: selectedId },
          data: { status: suggestedStatus },
        });

        const updatedReviewItem = await tx.reviewItem.update({
          where: { id },
          data: {
            type: effectiveType,
            company,
            role,
            location,
            suggestedStatus,
            matchedApplicationId: selectedId,
            reviewStatus: ReviewStatus.approved,
          },
        });
        return { updatedApplication, updatedReviewItem };
      });

      return NextResponse.json({
        ok: true,
        reviewItem: updated.updatedReviewItem,
        updatedApplication: updated.updatedApplication,
      });
    }

    if (effectiveType === ReviewItemType.unknown_job_related) {
      return NextResponse.json(
        {
          error:
            "unknown_job_related must be converted to new_application, task, or status_update before approval",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unsupported review item type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unexpected approve error" }, { status: 500 });
  }
}
