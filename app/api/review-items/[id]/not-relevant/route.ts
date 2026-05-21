import { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const item = await prisma.reviewItem.update({
      where: { id },
      data: { reviewStatus: ReviewStatus.not_relevant },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  }
}
