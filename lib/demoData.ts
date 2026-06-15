import { ApplicationStatus, ReviewItemType, TaskStatus } from "@prisma/client";

export const DEMO_SOURCES = {
  application: "Demo",
  gmail: "Gmail Demo",
  task: "Demo",
  followUp: "Auto Follow-Up",
} as const;

export const DEMO_EMAIL_SUBJECTS = {
  linkedInSquadron: "Saad Salman, your application was sent to Squadron Data, Inc.",
  coreBankInterview: "CoreBank interview request for AWS Developer",
  brightHealthRejection: "Update on your BrightHealth Data Analyst application",
  unknownJobRelated: "Career opportunity follow-up",
} as const;

export const DEMO_SENDERS = {
  linkedIn: "LinkedIn <jobs-noreply@linkedin.com>",
  coreBank: "CoreBank Recruiting <recruiting@corebank.example>",
  brightHealth: "BrightHealth Careers <careers@brighthealth.example>",
  unknown: "Careers <careers@example.com>",
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

export function chicagoStoredDateFromOffset(daysFromToday: number, hourUtc = 17) {
  const chicagoToday = dateKeyInTimezone(new Date(), "America/Chicago");
  const dateKey = addDaysToDateKey(chicagoToday, daysFromToday);
  return new Date(`${dateKey}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);
}

export function yesterdayInChicagoDate() {
  return chicagoStoredDateFromOffset(-1, 17);
}

export function demoReviewItemsSeedData(now: Date) {
  const timestamp = now.toISOString();

  return [
    {
      type: ReviewItemType.new_application,
      company: "Squadron Data, Inc.",
      role: "Snowflake Solutions Architect",
      location: "Kansas City, MO",
      suggestedStatus: ApplicationStatus.Applied,
      source: DEMO_SOURCES.gmail,
      gmailMessageId: "demo-gmail-squadron-data",
      threadId: "demo-thread-squadron-data",
      emailSender: DEMO_SENDERS.linkedIn,
      emailSubject: DEMO_EMAIL_SUBJECTS.linkedInSquadron,
      emailReceivedAt: now,
      confidence: 0.94,
      extractedDataJson: JSON.stringify({
        demoSeed: true,
        seededAt: timestamp,
        reason: "Demo LinkedIn application confirmation fixture",
      }),
    },
    {
      type: ReviewItemType.status_update,
      company: "CoreBank",
      role: "AWS Developer",
      location: "Austin, TX",
      suggestedStatus: ApplicationStatus.Interview,
      taskTitle: "Schedule interview",
      source: DEMO_SOURCES.gmail,
      gmailMessageId: "demo-gmail-corebank-interview",
      threadId: "demo-thread-corebank-interview",
      emailSender: DEMO_SENDERS.coreBank,
      emailSubject: DEMO_EMAIL_SUBJECTS.coreBankInterview,
      emailReceivedAt: now,
      confidence: 0.91,
      extractedDataJson: JSON.stringify({
        demoSeed: true,
        seededAt: timestamp,
        reason: "Demo interview request fixture",
      }),
    },
    {
      type: ReviewItemType.status_update,
      company: "BrightHealth",
      role: "Data Analyst",
      location: "Dallas, TX",
      suggestedStatus: ApplicationStatus.Rejected,
      source: DEMO_SOURCES.gmail,
      gmailMessageId: "demo-gmail-brighthealth-rejection",
      threadId: "demo-thread-brighthealth-rejection",
      emailSender: DEMO_SENDERS.brightHealth,
      emailSubject: DEMO_EMAIL_SUBJECTS.brightHealthRejection,
      emailReceivedAt: now,
      confidence: 0.9,
      extractedDataJson: JSON.stringify({
        demoSeed: true,
        seededAt: timestamp,
        reason: "Demo rejection email fixture",
      }),
    },
    {
      type: ReviewItemType.unknown_job_related,
      company: "Unknown Company",
      role: null,
      location: null,
      source: DEMO_SOURCES.gmail,
      gmailMessageId: "demo-gmail-unknown-job-related",
      threadId: "demo-thread-unknown-job-related",
      emailSender: DEMO_SENDERS.unknown,
      emailSubject: DEMO_EMAIL_SUBJECTS.unknownJobRelated,
      emailReceivedAt: now,
      confidence: 0.52,
      extractedDataJson: JSON.stringify({
        demoSeed: true,
        seededAt: timestamp,
        reason: "Demo unknown job-related fixture",
      }),
    },
  ];
}

export function demoApplicationsSeedData() {
  return [
    {
      company: "NovaCloud",
      role: "Cloud Support Engineer",
      status: ApplicationStatus.Applied,
      location: "Remote",
      dateApplied: chicagoStoredDateFromOffset(-4),
      source: DEMO_SOURCES.application,
      notes: "Sample active application for demo follow-up workflow.",
    },
    {
      company: "AtlasAI",
      role: "Software Engineer",
      status: ApplicationStatus.Applied,
      location: "Austin, TX",
      dateApplied: chicagoStoredDateFromOffset(-2),
      source: DEMO_SOURCES.application,
    },
    {
      company: "CoreBank",
      role: "AWS Developer",
      status: ApplicationStatus.Interview,
      location: "Austin, TX",
      dateApplied: chicagoStoredDateFromOffset(-12),
      source: DEMO_SOURCES.application,
      interviewStatus: "Scheduled",
      interviewDate: chicagoStoredDateFromOffset(3, 20),
      interviewWith: "Sarah Lee",
      interviewNotes: "Technical screen",
    },
    {
      company: "BrightHealth",
      role: "Data Analyst",
      status: ApplicationStatus.Rejected,
      location: "Dallas, TX",
      dateApplied: chicagoStoredDateFromOffset(-16),
      source: DEMO_SOURCES.application,
      notes: "Rejected after resume review.",
    },
    {
      company: "Meridian Systems",
      role: "Backend Engineer",
      status: ApplicationStatus.Offer,
      location: "Remote",
      dateApplied: chicagoStoredDateFromOffset(-22),
      source: DEMO_SOURCES.application,
    },
    {
      company: "Northstar Labs",
      role: "Infrastructure Engineer",
      status: ApplicationStatus.Interview,
      location: "Houston, TX",
      dateApplied: chicagoStoredDateFromOffset(-18),
      source: DEMO_SOURCES.application,
      interviewStatus: "Waiting for next steps",
      interviewDate: chicagoStoredDateFromOffset(-2, 19),
      interviewNotes: "Completed recruiter screen",
    },
    {
      company: "CloudForge",
      role: "DevOps Engineer",
      status: ApplicationStatus.Withdrawn,
      location: "Seattle, WA",
      dateApplied: chicagoStoredDateFromOffset(-28),
      source: DEMO_SOURCES.application,
      notes: "Withdrawn for demo storyline.",
    },
    {
      company: "SignalWorks",
      role: "Support Engineer",
      status: ApplicationStatus.Applied,
      location: "Hybrid",
      dateApplied: chicagoStoredDateFromOffset(-1),
      source: DEMO_SOURCES.application,
    },
  ];
}

export function demoTasksSeedData(applicationIdsByCompany: Map<string, number>) {
  return [
    {
      applicationId: applicationIdsByCompany.get("NovaCloud") ?? null,
      company: "NovaCloud",
      role: "Cloud Support Engineer",
      title: "Follow up with NovaCloud",
      status: TaskStatus.pending,
      dueDate: chicagoStoredDateFromOffset(0),
      sourceEmailSubject: DEMO_SOURCES.task,
      notes: "Ask the recruiter for an update on the Cloud Support Engineer role.",
    },
    {
      applicationId: applicationIdsByCompany.get("CoreBank") ?? null,
      company: "CoreBank",
      role: "AWS Developer",
      title: "Prepare for CoreBank technical interview",
      status: TaskStatus.pending,
      dueDate: chicagoStoredDateFromOffset(2),
      sourceEmailSubject: DEMO_SOURCES.task,
      notes: "Review AWS VPC, IAM, EC2, S3, and troubleshooting stories.",
    },
    {
      applicationId: null,
      company: "General",
      role: null,
      title: "Update resume for AWS roles",
      status: TaskStatus.pending,
      dueDate: chicagoStoredDateFromOffset(1),
      sourceEmailSubject: DEMO_SOURCES.task,
      notes: "Emphasize AWS support, Linux, networking, and troubleshooting.",
    },
    {
      applicationId: applicationIdsByCompany.get("Northstar Labs") ?? null,
      company: "Northstar Labs",
      role: "Infrastructure Engineer",
      title: "Send thank-you note to Northstar Labs",
      status: TaskStatus.completed,
      dueDate: chicagoStoredDateFromOffset(-1),
      sourceEmailSubject: DEMO_SOURCES.task,
      notes: "Thank recruiter after screen.",
    },
    {
      applicationId: applicationIdsByCompany.get("BrightHealth") ?? null,
      company: "BrightHealth",
      role: "Data Analyst",
      title: "Review BrightHealth rejection notes",
      status: TaskStatus.completed,
      dueDate: chicagoStoredDateFromOffset(-3),
      sourceEmailSubject: DEMO_SOURCES.task,
      notes: "Use feedback to improve analyst resume bullets.",
    },
  ];
}

export function demoGuestCompanySuggestionsSeedData() {
  return [
    {
      companyName: "Airtable",
      suggestedBy: "Demo Mentor",
      notes: "Could be a good fit for support engineering or implementation roles.",
      status: "new",
    },
    {
      companyName: "Datadog",
      suggestedBy: "Demo Family",
      notes: "Cloud monitoring and technical support roles may match your background.",
      status: "reviewed",
    },
  ];
}
