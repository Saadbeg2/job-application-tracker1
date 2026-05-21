import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  await prisma.gmailConnection.deleteMany();
  return NextResponse.json({ disconnected: true });
}
