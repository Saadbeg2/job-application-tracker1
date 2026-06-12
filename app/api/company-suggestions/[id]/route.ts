import { getAdminSession } from "@/lib/authServer";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_STATUSES = new Set(["new", "reviewed", "dismissed", "applied"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = String(body?.status ?? "").trim();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid suggestion status." }, { status: 400 });
  }

  const [suggestion] = await prisma.$queryRaw<
    Array<{
      id: string;
      companyName: string;
      suggestedBy: string | null;
      notes: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  >`
    UPDATE "GuestCompanySuggestion"
    SET "status" = ${status}, "updatedAt" = NOW()
    WHERE "id" = ${params.id}
    RETURNING "id", "companyName", "suggestedBy", "notes", "status", "createdAt", "updatedAt"
  `;

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json(suggestion);
}
