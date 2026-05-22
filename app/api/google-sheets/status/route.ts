import { sheetsStatus } from "@/lib/googleSheets";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
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
