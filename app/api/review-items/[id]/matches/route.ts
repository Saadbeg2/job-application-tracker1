import { ReviewItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnlyKey, roleSimilarityScore } from "@/lib/review";
import { NextResponse } from "next/server";

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = await prisma.reviewItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Review item not found" }, { status: 404 });

  const allApplications = await prisma.application.findMany({
    orderBy: { dateApplied: "desc" },
    take: 100,
  });
  const candidates = allApplications.filter(
    (application) => application.company.trim().toLowerCase() === item.company.trim().toLowerCase(),
  );

  const matches = candidates
    .map((application) => ({
      ...application,
      roleScore: roleSimilarityScore(item.role, application.role),
      dateKey: dateOnlyKey(application.dateApplied),
    }))
    .sort((a, b) => b.roleScore - a.roleScore || b.dateApplied.getTime() - a.dateApplied.getTime());

  const duplicateCandidates =
    item.type === ReviewItemType.new_application && item.emailReceivedAt
      ? matches.filter(
          (application) =>
            dateOnlyKey(application.dateApplied) === dateOnlyKey(item.emailReceivedAt as Date) &&
            application.roleScore > 0,
        )
      : [];

  return NextResponse.json({
    reviewItemType: item.type,
    matches,
    duplicateCandidates,
  });
}
