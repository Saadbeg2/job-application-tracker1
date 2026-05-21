/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, ApplicationStatus, ReviewItemType, ReviewStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.reviewItem.deleteMany();

  const baseApps = [
    {
      company: "Amazon",
      role: "Software Engineer II",
      dateApplied: new Date("2026-05-19T00:00:00.000Z"),
      status: ApplicationStatus.Applied,
      source: "LinkedIn",
      jobLink: "https://example.com/amazon-se2",
    },
    {
      company: "Visa",
      role: "Backend Engineer",
      dateApplied: new Date("2026-05-21T00:00:00.000Z"),
      status: ApplicationStatus.Applied,
      source: "Company Site",
      jobLink: "https://example.com/visa-backend",
    },
  ];

  for (const app of baseApps) {
    const exists = await prisma.application.findFirst({
      where: { company: app.company, role: app.role, jobLink: app.jobLink },
    });
    if (!exists) {
      await prisma.application.create({ data: app });
    }
  }

  const visaApp = await prisma.application.findFirst({
    where: { company: "Visa" },
    orderBy: { createdAt: "desc" },
  });

  await prisma.reviewItem.createMany({
    data: [
      {
        type: ReviewItemType.new_application,
        reviewStatus: ReviewStatus.pending,
        company: "Stripe",
        role: "Software Engineer",
        source: "Gmail",
        gmailMessageId: "msg-seed-001",
        emailSender: "jobs@stripe.com",
        emailSubject: "Thanks for applying to Stripe",
        emailReceivedAt: new Date("2026-05-21T14:15:00.000Z"),
        confidence: 0.95,
        extractedDataJson: JSON.stringify({
          classification: "application_confirmation",
          portal: "Stripe Careers",
        }),
      },
      {
        type: ReviewItemType.status_update,
        reviewStatus: ReviewStatus.pending,
        company: "Amazon",
        role: "Software Engineer II",
        suggestedStatus: ApplicationStatus.Rejected,
        source: "Gmail",
        gmailMessageId: "msg-seed-002",
        emailSender: "no-reply@amazon.jobs",
        emailSubject: "Update on your Amazon application",
        emailReceivedAt: new Date("2026-05-21T16:00:00.000Z"),
        confidence: 0.91,
        extractedDataJson: JSON.stringify({
          classification: "status_update",
          statusHint: "Rejected",
        }),
      },
      {
        type: ReviewItemType.task,
        reviewStatus: ReviewStatus.pending,
        company: "Visa",
        role: "Backend Engineer",
        taskTitle: "Complete Visa OA before deadline",
        source: "Gmail",
        gmailMessageId: "msg-seed-003",
        emailSender: "recruiting@visa.com",
        emailSubject: "Visa assessment invitation",
        emailReceivedAt: new Date("2026-05-21T12:30:00.000Z"),
        confidence: 0.9,
        matchedApplicationId: visaApp ? visaApp.id : null,
        extractedDataJson: JSON.stringify({
          classification: "action_required",
          actionType: "assessment",
        }),
      },
      {
        type: ReviewItemType.unknown_job_related,
        reviewStatus: ReviewStatus.pending,
        company: "Meta",
        role: "Software Engineer",
        source: "Gmail",
        gmailMessageId: "msg-seed-004",
        emailSender: "alerts@meta.com",
        emailSubject: "Career profile update reminder",
        emailReceivedAt: new Date("2026-05-20T11:45:00.000Z"),
        confidence: 0.55,
        extractedDataJson: JSON.stringify({
          classification: "uncertain",
          reason: "career_email_generic",
        }),
      },
    ],
  });

  console.log("Seeded review queue samples.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
