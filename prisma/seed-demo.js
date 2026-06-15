const {
  ApplicationStatus,
  PrismaClient,
  ReviewItemType,
  TaskStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();

function requireDemoMode() {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Refusing to seed demo data because DEMO_MODE is not true.");
  }
}

function dateKeyInTimezone(date, timezone) {
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

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function chicagoStoredDateFromOffset(daysFromToday, hourUtc = 17) {
  const chicagoToday = dateKeyInTimezone(new Date(), "America/Chicago");
  const dateKey = addDaysToDateKey(chicagoToday, daysFromToday);
  return new Date(`${dateKey}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);
}

function demoReviewItems(now) {
  const timestamp = now.toISOString();
  return [
    {
      type: ReviewItemType.new_application,
      company: "Squadron Data, Inc.",
      role: "Snowflake Solutions Architect",
      location: "Kansas City, MO",
      suggestedStatus: ApplicationStatus.Applied,
      source: "Gmail Demo",
      gmailMessageId: "demo-gmail-squadron-data",
      threadId: "demo-thread-squadron-data",
      emailSender: "LinkedIn <jobs-noreply@linkedin.com>",
      emailSubject: "Saad Salman, your application was sent to Squadron Data, Inc.",
      emailReceivedAt: now,
      confidence: 0.94,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.status_update,
      company: "CoreBank",
      role: "AWS Developer",
      location: "Austin, TX",
      suggestedStatus: ApplicationStatus.Interview,
      taskTitle: "Schedule interview",
      source: "Gmail Demo",
      gmailMessageId: "demo-gmail-corebank-interview",
      threadId: "demo-thread-corebank-interview",
      emailSender: "CoreBank Recruiting <recruiting@corebank.example>",
      emailSubject: "CoreBank interview request for AWS Developer",
      emailReceivedAt: now,
      confidence: 0.91,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.status_update,
      company: "BrightHealth",
      role: "Data Analyst",
      location: "Dallas, TX",
      suggestedStatus: ApplicationStatus.Rejected,
      source: "Gmail Demo",
      gmailMessageId: "demo-gmail-brighthealth-rejection",
      threadId: "demo-thread-brighthealth-rejection",
      emailSender: "BrightHealth Careers <careers@brighthealth.example>",
      emailSubject: "Update on your BrightHealth Data Analyst application",
      emailReceivedAt: now,
      confidence: 0.9,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
    {
      type: ReviewItemType.unknown_job_related,
      company: "Unknown Company",
      role: null,
      location: null,
      source: "Gmail Demo",
      gmailMessageId: "demo-gmail-unknown-job-related",
      threadId: "demo-thread-unknown-job-related",
      emailSender: "Careers <careers@example.com>",
      emailSubject: "Career opportunity follow-up",
      emailReceivedAt: now,
      confidence: 0.52,
      extractedDataJson: JSON.stringify({ demoSeed: true, seededAt: timestamp }),
    },
  ];
}

const applications = [
  ["NovaCloud", "Cloud Support Engineer", ApplicationStatus.Applied, "Remote", -4, null, null, null, null],
  ["AtlasAI", "Software Engineer", ApplicationStatus.Applied, "Austin, TX", -2, null, null, null, null],
  ["CoreBank", "AWS Developer", ApplicationStatus.Interview, "Austin, TX", -12, "Scheduled", 3, "Sarah Lee", "Technical screen"],
  ["BrightHealth", "Data Analyst", ApplicationStatus.Rejected, "Dallas, TX", -16, null, null, null, "Rejected after resume review."],
  ["Meridian Systems", "Backend Engineer", ApplicationStatus.Offer, "Remote", -22, null, null, null, null],
  ["Northstar Labs", "Infrastructure Engineer", ApplicationStatus.Interview, "Houston, TX", -18, "Waiting for next steps", -2, null, "Completed recruiter screen"],
  ["CloudForge", "DevOps Engineer", ApplicationStatus.Withdrawn, "Seattle, WA", -28, null, null, null, "Withdrawn for demo storyline."],
  ["SignalWorks", "Support Engineer", ApplicationStatus.Applied, "Hybrid", -1, null, null, null, null],
];

async function clearDemoDatabase() {
  await prisma.reportSendLog.deleteMany();
  await prisma.reportRecipient.deleteMany();
  await prisma.emailMetadata.deleteMany();
  await prisma.reviewItem.deleteMany();
  await prisma.task.deleteMany();
  await prisma.application.deleteMany();
  await prisma.scanHistory.deleteMany();
  await prisma.googleSheetSync.deleteMany();
  await prisma.guestCompanySuggestion.deleteMany();
}

async function main() {
  requireDemoMode();
  await clearDemoDatabase();

  const applicationIdsByCompany = new Map();
  for (const [company, role, status, location, offset, interviewStatus, interviewOffset, interviewWith, notes] of applications) {
    const app = await prisma.application.create({
      data: {
        company,
        role,
        status,
        location,
        dateApplied: chicagoStoredDateFromOffset(offset),
        source: "Demo",
        notes,
      },
    });
    applicationIdsByCompany.set(company, app.id);

    if (interviewStatus || interviewOffset !== null || interviewWith) {
      await prisma.$executeRaw`
        UPDATE "Application"
        SET
          "interviewStatus" = ${interviewStatus},
          "interviewDate" = ${interviewOffset === null ? null : chicagoStoredDateFromOffset(interviewOffset, 20)},
          "interviewWith" = ${interviewWith},
          "interviewNotes" = ${notes}
        WHERE "id" = ${app.id}
      `;
    }
  }

  await prisma.task.createMany({
    data: [
      {
        applicationId: applicationIdsByCompany.get("NovaCloud"),
        company: "NovaCloud",
        role: "Cloud Support Engineer",
        title: "Follow up with NovaCloud",
        status: TaskStatus.pending,
        dueDate: chicagoStoredDateFromOffset(0),
        sourceEmailSubject: "Demo",
        notes: "Ask the recruiter for an update on the Cloud Support Engineer role.",
      },
      {
        applicationId: applicationIdsByCompany.get("CoreBank"),
        company: "CoreBank",
        role: "AWS Developer",
        title: "Prepare for CoreBank technical interview",
        status: TaskStatus.pending,
        dueDate: chicagoStoredDateFromOffset(2),
        sourceEmailSubject: "Demo",
        notes: "Review AWS VPC, IAM, EC2, S3, and troubleshooting stories.",
      },
      {
        company: "General",
        title: "Update resume for AWS roles",
        status: TaskStatus.pending,
        dueDate: chicagoStoredDateFromOffset(1),
        sourceEmailSubject: "Demo",
        notes: "Emphasize AWS support, Linux, networking, and troubleshooting.",
      },
      {
        applicationId: applicationIdsByCompany.get("Northstar Labs"),
        company: "Northstar Labs",
        role: "Infrastructure Engineer",
        title: "Send thank-you note to Northstar Labs",
        status: TaskStatus.completed,
        dueDate: chicagoStoredDateFromOffset(-1),
        sourceEmailSubject: "Demo",
        notes: "Thank recruiter after screen.",
      },
      {
        applicationId: applicationIdsByCompany.get("BrightHealth"),
        company: "BrightHealth",
        role: "Data Analyst",
        title: "Review BrightHealth rejection notes",
        status: TaskStatus.completed,
        dueDate: chicagoStoredDateFromOffset(-3),
        sourceEmailSubject: "Demo",
        notes: "Use feedback to improve analyst resume bullets.",
      },
    ],
  });

  await prisma.reviewItem.createMany({ data: demoReviewItems(new Date()) });

  await prisma.guestCompanySuggestion.createMany({
    data: [
      {
        companyName: "Airtable",
        suggestedBy: "Demo Mentor",
        notes: "Could be a good fit for support engineering or implementation roles.",
      },
      {
        companyName: "Datadog",
        suggestedBy: "Demo Family",
        notes: "Cloud monitoring and technical support roles may match your background.",
        status: "reviewed",
      },
    ],
  });

  console.log("Demo database seeded with sample applications, tasks, review items, and guest suggestions.");
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
