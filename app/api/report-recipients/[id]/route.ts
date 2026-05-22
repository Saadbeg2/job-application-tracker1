import { SUPPORTED_TIMEZONES } from "@/lib/dailyReport";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseId(value: string) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      timezone?: string;
      active?: boolean;
    };

    const data: {
      name?: string;
      email?: string;
      timezone?: string;
      active?: boolean;
    } = {};

    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
    if (typeof body.timezone === "string") {
      if (!SUPPORTED_TIMEZONES.includes(body.timezone as (typeof SUPPORTED_TIMEZONES)[number])) {
        return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
      }
      data.timezone = body.timezone;
    }
    if (typeof body.active === "boolean") data.active = body.active;

    const updated = await prisma.reportRecipient.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update recipient" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await prisma.reportRecipient.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete recipient" }, { status: 500 });
  }
}
