import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const history = await prisma.scanHistory.findMany({
    orderBy: { scanStartedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(history);
}
