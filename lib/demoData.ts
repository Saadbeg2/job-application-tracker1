import { ApplicationStatus, ReviewItemType } from "@prisma/client";

export const DEMO_SOURCES = {
  application: "Demo",
  gmail: "Gmail Demo",
} as const;

export const DEMO_EMAIL_SUBJECTS = {
  dow: "Thank You for Your Application",
  linkedIn: "Saad Salman, your application was sent to BrothersTech",
  agoda: "Regarding your Application to Agoda",
  amazon: "Welcome to Amazon Assessments - ACTION REQUIRED",
  nagarro: "Nagarro Interview confirmed | Interview with Saad Beg",
} as const;

export const DEMO_SENDERS = {
  dow: "dow@myworkday.com",
  linkedIn: "jobs-noreply@linkedin.com",
  agoda: "no-reply@agoda.global",
  amazon: "noreply@mail.amazon.jobs",
  nagarro: "hiringautomation.user@nagarro.com",
} as const;

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

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function yesterdayInChicagoDate() {
  const chicagoToday = dateKeyInTimezone(new Date(), "America/Chicago");
  const yesterday = addDaysToDateKey(chicagoToday, -1);
  return new Date(`${yesterday}T12:00:00.000Z`);
}

export function demoReviewItemsSeedData(now: Date) {
  const timestamp = now.toISOString();

  return [
    {
      type: ReviewItemType.new_application,
      company: "Dow",
      role: "IT Analyst",
      suggestedStatus: ApplicationStatus.Applied,
      source: DEMO_SOURCES.gmail,
      emailSender: DEMO_SENDERS.dow,
      emailSubject: DEMO_EMAIL_SUBJECTS.dow,
      emailReceivedAt: now,
      confidence: 0.95,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.new_application,
      company: "BrothersTech",
      role: null,
      suggestedStatus: ApplicationStatus.Applied,
      source: DEMO_SOURCES.gmail,
      emailSender: DEMO_SENDERS.linkedIn,
      emailSubject: DEMO_EMAIL_SUBJECTS.linkedIn,
      emailReceivedAt: now,
      confidence: 0.9,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.status_update,
      company: "Agoda",
      role: "Data Analyst",
      suggestedStatus: ApplicationStatus.Rejected,
      source: DEMO_SOURCES.gmail,
      emailSender: DEMO_SENDERS.agoda,
      emailSubject: DEMO_EMAIL_SUBJECTS.agoda,
      emailReceivedAt: now,
      confidence: 0.92,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.task,
      company: "Amazon",
      role: "Software Development Engineer",
      taskTitle: "Complete assessment",
      source: DEMO_SOURCES.gmail,
      emailSender: DEMO_SENDERS.amazon,
      emailSubject: DEMO_EMAIL_SUBJECTS.amazon,
      emailReceivedAt: now,
      confidence: 0.88,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.status_update,
      company: "Nagarro",
      role: "Software Engineer",
      suggestedStatus: ApplicationStatus.Interview,
      source: DEMO_SOURCES.gmail,
      emailSender: DEMO_SENDERS.nagarro,
      emailSubject: DEMO_EMAIL_SUBJECTS.nagarro,
      emailReceivedAt: now,
      confidence: 0.9,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
  ];
}
