import { buildDailyReport } from "@/lib/dailyReport";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/reportMailer";
import { ReportSendStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { recipientId?: number; all?: boolean };
  const forceAll = body.all === true;

  const recipients = forceAll
    ? await prisma.reportRecipient.findMany({ where: { active: true } })
    : body.recipientId
      ? await prisma.reportRecipient.findMany({ where: { id: body.recipientId } })
      : await prisma.reportRecipient.findMany({ where: { active: true }, take: 1 });

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  const results: Array<{ recipientId: number; email: string; status: "sent" | "failed"; error?: string }> = [];

  for (const recipient of recipients) {
    const report = await buildDailyReport(prisma);
    try {
      await sendReportEmail(recipient.email, report.subject, report.body);
      await prisma.reportSendLog.create({
        data: {
          recipientId: recipient.id,
          reportDate: `${report.reportDate}-test-${Date.now()}`,
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.sent,
        },
      });
      results.push({ recipientId: recipient.id, email: recipient.email, status: "sent" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.slice(0, 250) : "Unknown send error";
      await prisma.reportSendLog.create({
        data: {
          recipientId: recipient.id,
          reportDate: `${report.reportDate}-test-${Date.now()}`,
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.failed,
          errorMessage,
        },
      });
      results.push({ recipientId: recipient.id, email: recipient.email, status: "failed", error: errorMessage });
    }
  }

  return NextResponse.json({ ok: true, results });
}
