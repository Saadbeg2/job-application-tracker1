import { prisma } from "@/lib/prisma";
import { buildReviewItemData } from "@/lib/review";
import { NextResponse } from "next/server";

type ReviewItemRow = {
  id: number;
  type: string;
  reviewStatus: string;
  company: string;
  role: string | null;
  location: string | null;
  suggestedStatus: string | null;
  taskTitle: string | null;
  source: string | null;
  gmailMessageId: string | null;
  threadId: string | null;
  emailSender: string | null;
  emailSubject: string | null;
  emailReceivedAt: Date | null;
  confidence: number | null;
  matchedApplicationId: number | null;
  extractedDataJson: string | null;
  extractionMethod: string | null;
  extractionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET() {
  const reviewItems = await prisma.$queryRaw<ReviewItemRow[]>`
    SELECT
      "id",
      "type",
      "reviewStatus",
      "company",
      "role",
      "location",
      "suggestedStatus",
      "taskTitle",
      "source",
      "gmailMessageId",
      "threadId",
      "emailSender",
      "emailSubject",
      "emailReceivedAt",
      "confidence",
      "matchedApplicationId",
      "extractedDataJson",
      "extractionMethod",
      "extractionReason",
      "createdAt",
      "updatedAt"
    FROM "ReviewItem"
    ORDER BY "reviewStatus" ASC, "createdAt" DESC
  `;

  return NextResponse.json(reviewItems);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = buildReviewItemData(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const item = await prisma.reviewItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
