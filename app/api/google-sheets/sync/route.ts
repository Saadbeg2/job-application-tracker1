import { syncSpreadsheet } from "@/lib/googleSheets";
import { isDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "Google Sheets sync is disabled in Demo Mode. No real spreadsheet was updated." },
        { status: 403 },
      );
    }

    return NextResponse.json(await syncSpreadsheet(prisma));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync spreadsheet";
    const status = ["GOOGLE_NOT_CONNECTED", "MISSING_SHEETS_SCOPE", "SHEET_NOT_CONFIGURED"].includes(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
