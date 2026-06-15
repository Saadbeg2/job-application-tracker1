import { sheetsStatus } from "@/lib/googleSheets";
import { isDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({
        connected: false,
        googleConnected: false,
        missingScope: false,
        envConfigured: false,
        spreadsheetId: null,
        spreadsheetUrl: null,
        lastSyncedAt: null,
        lastSyncStatus: "disabled",
        lastSyncError: null,
        demoMode: true,
        message: "Google Sheets sync is disabled in Demo Mode. No real spreadsheet is connected.",
      });
    }

    const status = await sheetsStatus(prisma);
    let message: string | null = null;
    if (!status.googleConnected) {
      message = "Google is not connected.";
    } else if (status.missingScope) {
      message = "Google Sheets permission is missing. Reconnect Google.";
    } else if (!status.spreadsheetId) {
      message = "No tracker spreadsheet configured. Add GOOGLE_SHEETS_SPREADSHEET_ID to .env.";
    }
    return NextResponse.json({ ...status, message });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Google Sheets status" }, { status: 500 });
  }
}
