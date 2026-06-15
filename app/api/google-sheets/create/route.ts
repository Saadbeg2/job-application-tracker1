import { createTrackerSpreadsheet } from "@/lib/googleSheets";
import { isDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "Google Sheets creation is disabled in Demo Mode. No real spreadsheet was created." },
        { status: 403 },
      );
    }

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
