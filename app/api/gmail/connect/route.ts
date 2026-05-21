import { buildConnectUrl } from "@/lib/gmail";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = buildConnectUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Gmail OAuth" },
      { status: 500 },
    );
  }
}
