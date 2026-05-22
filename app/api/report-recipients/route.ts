import { SUPPORTED_TIMEZONES } from "@/lib/dailyReport";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const recipients = await prisma.reportRecipient.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return NextResponse.json(recipients);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      timezone?: string;
      active?: boolean;
    };

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const timezone = body.timezone?.trim() ?? "";

    if (!name || !email || !timezone) {
      return NextResponse.json({ error: "name, email, and timezone are required" }, { status: 400 });
    }

    if (!SUPPORTED_TIMEZONES.includes(timezone as (typeof SUPPORTED_TIMEZONES)[number])) {
      return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
    }

    const created = await prisma.reportRecipient.create({
      data: {
        name,
        email,
        timezone,
        active: body.active ?? true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create recipient" }, { status: 500 });
  }
}
