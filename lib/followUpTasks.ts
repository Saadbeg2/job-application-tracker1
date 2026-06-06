import { chicagoDateKeyToStoredDate, getTodayChicagoDateKey } from "@/lib/dates";
import { getStaleApplications, type FollowUpApplication } from "@/lib/followUpAlerts";
import { PrismaClient, TaskStatus } from "@prisma/client";

const FOLLOW_UP_SOURCE = "Auto Follow-Up";

function followUpTitle(company: string, role: string) {
  return `Follow up with recruiter for ${company} — ${role}`;
}

function followUpNotes(company: string, role: string, daysSince: number) {
  return [
    `No update in ${daysSince} days. Find the recruiter or hiring manager for this role and send a polite follow-up message.`,
    "",
    `Hi [Recruiter Name], I hope you’re doing well. I wanted to follow up on my application for the ${role} position at ${company}. I’m still very interested in the opportunity and would appreciate any update when available. Thank you!`,
  ].join("\n");
}

export async function ensureFollowUpTasks(prisma: PrismaClient) {
  const applications = await prisma.application.findMany({
    select: {
      id: true,
      company: true,
      role: true,
      status: true,
      dateApplied: true,
      lastFollowedUpAt: true,
      followUpCount: true,
    },
  });

  const staleApps = getStaleApplications(applications as FollowUpApplication[]);
  if (staleApps.length === 0) return { created: 0 };

  const staleIds = staleApps.map((app) => app.id);

  const existingOpen = await prisma.task.findMany({
    where: {
      applicationId: { in: staleIds },
      sourceEmailSubject: FOLLOW_UP_SOURCE,
      status: TaskStatus.pending,
    },
    select: { applicationId: true },
  });

  const existingSet = new Set(existingOpen.map((task) => task.applicationId).filter((id): id is number => id !== null));

  let created = 0;
  for (const app of staleApps) {
    if (existingSet.has(app.id)) continue;

    await prisma.task.create({
      data: {
        applicationId: app.id,
        company: app.company,
        role: app.role,
        title: followUpTitle(app.company, app.role),
        status: TaskStatus.pending,
        dueDate: chicagoDateKeyToStoredDate(getTodayChicagoDateKey()),
        sourceEmailSubject: FOLLOW_UP_SOURCE,
        notes: followUpNotes(app.company, app.role, app.daysSinceLastUpdate),
      },
    });

    created += 1;
  }

  return { created };
}

export function isFollowUpTask(sourceEmailSubject: string) {
  return sourceEmailSubject === FOLLOW_UP_SOURCE;
}
