import { getAdminOrGuestSession } from "@/lib/authServer";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function cleanOptional(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function POST(request: Request) {
  const session = await getAdminOrGuestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    companyName?: unknown;
    suggestedBy?: unknown;
    notes?: unknown;
  } | null;

  const companyName = String(body?.companyName ?? "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const [suggestion] = await prisma.$queryRaw<
    Array<{ id: string; companyName: string; status: string; createdAt: Date }>
  >`
    INSERT INTO "GuestCompanySuggestion" ("id", "companyName", "suggestedBy", "notes", "updatedAt")
    VALUES (${id}, ${companyName}, ${cleanOptional(body?.suggestedBy)}, ${cleanOptional(body?.notes)}, NOW())
    RETURNING "id", "companyName", "status", "createdAt"
  `;

  return NextResponse.json({ ok: true, suggestion }, { status: 201 });
}
