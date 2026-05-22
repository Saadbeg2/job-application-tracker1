import { disconnectSpreadsheet } from "@/lib/googleSheets";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json(await disconnectSpreadsheet(prisma));
  } catch {
    return NextResponse.json({ error: "Failed to disconnect spreadsheet" }, { status: 500 });
  }
}
