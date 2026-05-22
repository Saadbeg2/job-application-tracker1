import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const logs = await prisma.reportSendLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
    include: {
      recipient: {
        select: { name: true, email: true, timezone: true },
      },
    },
  });
  return NextResponse.json(logs);
}
