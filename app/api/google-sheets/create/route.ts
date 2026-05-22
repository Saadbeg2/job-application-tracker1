import { createTrackerSpreadsheet } from "@/lib/googleSheets";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const sheet = await createTrackerSpreadsheet(prisma);
    return NextResponse.json({
      ok: true,
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create spreadsheet";
    const status = message === "GOOGLE_NOT_CONNECTED" || message === "MISSING_SHEETS_SCOPE" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
