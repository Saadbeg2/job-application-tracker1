import { scanDays } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  const lastScan = await prisma.scanHistory.findFirst({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    connected: Boolean(connection),
    providerAccountEmail: connection?.providerAccountEmail ?? null,
    connectedAt: connection?.connectedAt ?? null,
    lastScanAt: lastScan?.scanEndedAt ?? null,
    scanWindowDays: scanDays(),
  });
}
