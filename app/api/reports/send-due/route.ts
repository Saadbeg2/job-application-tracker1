import { buildDailyReport, isDueAtFivePm } from "@/lib/dailyReport";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/reportMailer";
import { ReportSendStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryForce = url.searchParams.get("force") === "true";
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = queryForce || body.force === true;

  const recipients = await prisma.reportRecipient.findMany({ where: { active: true } });
  const now = new Date();

  const results: Array<{ recipientId: number; email: string; status: "sent" | "failed" | "skipped"; reason?: string }> = [];

  for (const recipient of recipients) {
    const due = force || isDueAtFivePm(now, recipient.timezone);
    if (!due) {
      results.push({ recipientId: recipient.id, email: recipient.email, status: "skipped", reason: "Not due yet" });
      continue;
    }

    const report = await buildDailyReport(prisma);

    if (!force) {
      const existing = await prisma.reportSendLog.findUnique({
        where: {
          recipientId_reportDate: {
            recipientId: recipient.id,
            reportDate: report.reportDate,
          },
        },
      });

      if (existing && existing.status === ReportSendStatus.sent) {
        results.push({ recipientId: recipient.id, email: recipient.email, status: "skipped", reason: "Already sent" });
        continue;
      }
    }

    try {
      await sendReportEmail(recipient.email, report.subject, report.body);
      await prisma.reportSendLog.upsert({
        where: {
          recipientId_reportDate: {
            recipientId: recipient.id,
            reportDate: report.reportDate,
          },
        },
        update: {
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.sent,
          errorMessage: null,
        },
        create: {
          recipientId: recipient.id,
          reportDate: report.reportDate,
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.sent,
        },
      });
      results.push({ recipientId: recipient.id, email: recipient.email, status: "sent" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.slice(0, 250) : "Unknown send error";
      await prisma.reportSendLog.upsert({
        where: {
          recipientId_reportDate: {
            recipientId: recipient.id,
            reportDate: report.reportDate,
          },
        },
        update: {
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.failed,
          errorMessage,
        },
        create: {
          recipientId: recipient.id,
          reportDate: report.reportDate,
          timezone: recipient.timezone,
          sentAt: new Date(),
          status: ReportSendStatus.failed,
          errorMessage,
        },
      });
      results.push({ recipientId: recipient.id, email: recipient.email, status: "failed", reason: errorMessage });
    }
  }

  return NextResponse.json({ ok: true, force, results });
}
