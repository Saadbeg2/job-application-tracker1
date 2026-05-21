import { prisma } from "@/lib/prisma";
import { buildReviewItemData } from "@/lib/review";
import { NextResponse } from "next/server";

export async function GET() {
  const reviewItems = await prisma.reviewItem.findMany({
    orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
  });
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
