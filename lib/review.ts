import { ApplicationStatus, ReviewItemType, ReviewStatus } from "@prisma/client";
import { applicationStatuses, reviewItemTypes, reviewStatuses } from "@/lib/constants";

export type ReviewItemInput = {
  type?: string;
  reviewStatus?: string;
  company?: string;
  role?: string | null;
  suggestedStatus?: string | null;
  taskTitle?: string | null;
  source?: string | null;
  gmailMessageId?: string | null;
  emailSender?: string | null;
  emailSubject?: string | null;
  emailReceivedAt?: string | null;
  confidence?: number | null;
  matchedApplicationId?: number | null;
  extractedDataJson?: string | null;
};

export function normalizeReviewType(value: string | undefined) {
  if (!value) return null;
  return reviewItemTypes.includes(value as (typeof reviewItemTypes)[number])
    ? (value as ReviewItemType)
    : null;
}

export function normalizeReviewStatus(value: string | undefined) {
  if (!value) return null;
  return reviewStatuses.includes(value as (typeof reviewStatuses)[number])
    ? (value as ReviewStatus)
    : null;
}

export function normalizeApplicationStatus(value: string | undefined | null) {
  if (!value) return null;
  return applicationStatuses.includes(value as (typeof applicationStatuses)[number])
    ? (value as ApplicationStatus)
    : null;
}

export function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildReviewItemData(body: ReviewItemInput) {
  const type = normalizeReviewType(body.type);
  if (!type) return { error: "Invalid or missing review item type" };

  const company = String(body.company ?? "").trim();
  if (!company) return { error: "company is required" };

  const reviewStatus = body.reviewStatus ? normalizeReviewStatus(body.reviewStatus) : ReviewStatus.pending;
  if (!reviewStatus) return { error: "Invalid reviewStatus" };

  const suggestedStatus = normalizeApplicationStatus(body.suggestedStatus);
  if (body.suggestedStatus && !suggestedStatus) {
    return { error: "Invalid suggestedStatus" };
  }

  return {
    data: {
      type,
      reviewStatus,
      company,
      role: body.role?.trim() || null,
      suggestedStatus,
      taskTitle: body.taskTitle?.trim() || null,
      source: body.source?.trim() || null,
      gmailMessageId: body.gmailMessageId?.trim() || null,
      emailSender: body.emailSender?.trim() || null,
      emailSubject: body.emailSubject?.trim() || null,
      emailReceivedAt: body.emailReceivedAt ? new Date(body.emailReceivedAt) : null,
      confidence: body.confidence ?? null,
      matchedApplicationId: body.matchedApplicationId ?? null,
      extractedDataJson: body.extractedDataJson?.trim() || null,
    },
  };
}

export function roleSimilarityScore(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return 0;
  const aTokens = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const bTokens = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap;
}
