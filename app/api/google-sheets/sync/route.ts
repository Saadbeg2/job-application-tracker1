import { syncSpreadsheet } from "@/lib/googleSheets";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json(await syncSpreadsheet(prisma));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync spreadsheet";
    const status = ["GOOGLE_NOT_CONNECTED", "MISSING_SHEETS_SCOPE", "SHEET_NOT_CONFIGURED"].includes(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
