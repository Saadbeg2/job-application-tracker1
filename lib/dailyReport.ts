import { PrismaClient } from "@prisma/client";

export const SUPPORTED_TIMEZONES = ["Asia/Karachi", "America/Chicago", "Europe/London"] as const;
const REPORT_TIMEZONE = "America/Chicago";

function dateKeyInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Failed to compute date key");
  return `${year}-${month}-${day}`;
}

function hmInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

export function isDueAtFivePm(now: Date, timezone: string) {
  const { hour, minute } = hmInTimezone(now, timezone);
  return hour === 17 && minute < 15;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getConfiguredGoogleSheetUrl(prismaSheetUrl: string | null) {
  const envUrl = process.env.GOOGLE_SHEETS_SPREADSHEET_URL?.trim();
  const envId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

  if (envUrl) return envUrl;
  if (envId) return `https://docs.google.com/spreadsheets/d/${envId}/edit`;
  if (prismaSheetUrl?.trim()) return prismaSheetUrl.trim();

  return null;
}

export async function buildDailyReport(prisma: PrismaClient) {
  const now = new Date();
  const chicagoTodayKey = dateKeyInTimezone(now, REPORT_TIMEZONE);
  const reportDate = addDaysToDateKey(chicagoTodayKey, -1);

  const [applications, totalApplications, syncConfig] = await Promise.all([
    prisma.application.findMany({
      select: { company: true, role: true, dateApplied: true },
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.application.count(),
    prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const submittedYesterday = applications.filter((a) => a.dateApplied.toISOString().slice(0, 10) === reportDate);
  const applicationsYesterdayCount = submittedYesterday.length;
  const sheetUrl = getConfiguredGoogleSheetUrl(syncConfig?.spreadsheetUrl ?? null);

  const lines: string[] = [];
  lines.push("Hi,");
  lines.push("");
  lines.push("Here is the latest job application update:");
  lines.push("");
  lines.push(`Applications submitted yesterday: ${applicationsYesterdayCount}`);
  lines.push(`Total applications tracked: ${totalApplications}`);
  lines.push("");

  lines.push("Full tracker:");
  lines.push(sheetUrl ?? "Google Sheet link not configured.");
  lines.push("");
  lines.push("This is an automated daily report.");

  return {
    reportDate,
    subject: "Daily Job Application Report",
    body: lines.join("\n"),
    applicationsYesterdayCount,
    totalApplications,
    sheetUrl,
  };
}
