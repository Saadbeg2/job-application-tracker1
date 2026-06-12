import { getAdminSession } from "@/lib/authServer";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function normalizeCompany(value: string) {
  return value.trim().toLowerCase();
}

type GuestCompanySuggestionRow = {
  id: string;
  companyName: string;
  suggestedBy: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [suggestions, applications] = await Promise.all([
    prisma.$queryRaw<GuestCompanySuggestionRow[]>`
      SELECT "id", "companyName", "suggestedBy", "notes", "status", "createdAt", "updatedAt"
      FROM "GuestCompanySuggestion"
      ORDER BY "status" ASC, "createdAt" DESC
    `,
    prisma.application.findMany({
      select: { company: true },
    }),
  ]);

  const appliedCompanies = new Set(applications.map((application) => normalizeCompany(application.company)));

  return NextResponse.json(
    suggestions.map((suggestion) => ({
      ...suggestion,
      alreadyInApplications: appliedCompanies.has(normalizeCompany(suggestion.companyName)),
    })),
  );
}
