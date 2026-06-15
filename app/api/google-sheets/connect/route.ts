import { connectExistingSpreadsheet, parseSpreadsheetInput } from "@/lib/googleSheets";
import { isDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: "Google Sheets connection is disabled in Demo Mode. No real spreadsheet was connected." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { spreadsheetId?: string; spreadsheetUrl?: string };
    const raw = body.spreadsheetId ?? body.spreadsheetUrl ?? "";
    const parsed = parseSpreadsheetInput(raw);
    if (!parsed) {
      return NextResponse.json({ error: "Provide a valid spreadsheet ID or URL." }, { status: 400 });
    }

    const sheet = await connectExistingSpreadsheet(prisma, parsed);
    return NextResponse.json({
      ok: true,
      spreadsheetId: sheet.spreadsheetId,
      spreadsheetUrl: sheet.spreadsheetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect spreadsheet";
    const status = message === "GOOGLE_NOT_CONNECTED" || message === "MISSING_SHEETS_SCOPE" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
