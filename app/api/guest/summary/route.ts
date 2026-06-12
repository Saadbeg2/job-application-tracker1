import { getAdminOrGuestSession } from "@/lib/authServer";
import { getGuestDashboardSummary } from "@/lib/guestSummary";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAdminOrGuestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getGuestDashboardSummary(prisma));
}
