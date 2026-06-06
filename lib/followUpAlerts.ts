import { dateOnlyKeyFromStoredDate, getTodayChicagoDateKey, toChicagoDateKey } from "@/lib/dates";

type ApplicationStatusLike = "Applied" | "Interview" | "Rejected" | "Offer" | "Withdrawn";

const ACTIVE_STATUSES = new Set<ApplicationStatusLike>(["Applied", "Interview"]);
const FIRST_FOLLOW_UP_DAYS = 10;
const SECOND_FOLLOW_UP_DAYS = 15;

export type FollowUpApplication = {
  id: number;
  company: string;
  role: string;
  status: ApplicationStatusLike;
  dateApplied: Date;
  lastFollowedUpAt: Date | null;
  followUpCount: number;
};

function dateKeyToEpochDays(dateKey: string) {
  const dt = new Date(`${dateKey}T00:00:00.000Z`);
  return Math.floor(dt.getTime() / 86_400_000);
}

function maxDateKey(keys: string[]) {
  return keys.reduce((max, current) => (current > max ? current : max));
}

export function getFollowUpReferenceDate(application: FollowUpApplication) {
  if (application.followUpCount > 0 && application.lastFollowedUpAt) {
    return toChicagoDateKey(application.lastFollowedUpAt);
  }

  return maxDateKey([dateOnlyKeyFromStoredDate(application.dateApplied)]);
}

export function getDaysSinceLastMeaningfulUpdate(application: FollowUpApplication, todayKey = getTodayChicagoDateKey()) {
  const refKey = getFollowUpReferenceDate(application);
  return dateKeyToEpochDays(todayKey) - dateKeyToEpochDays(refKey);
}

export function isApplicationStale(application: FollowUpApplication, todayKey = getTodayChicagoDateKey()) {
  if (!ACTIVE_STATUSES.has(application.status)) return false;
  if (application.followUpCount >= 2) return false;
  if (application.followUpCount === 1 && !application.lastFollowedUpAt) return false;

  const daysSince = getDaysSinceLastMeaningfulUpdate(application, todayKey);
  const threshold = application.followUpCount === 0 ? FIRST_FOLLOW_UP_DAYS : SECOND_FOLLOW_UP_DAYS;
  return daysSince >= threshold;
}

export function getStaleApplications(applications: FollowUpApplication[], todayKey = getTodayChicagoDateKey()) {
  return applications
    .filter((application) => isApplicationStale(application, todayKey))
    .map((application) => ({
      ...application,
      daysSinceLastUpdate: getDaysSinceLastMeaningfulUpdate(application, todayKey),
      referenceDateKey: getFollowUpReferenceDate(application),
    }))
    .sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate || a.company.localeCompare(b.company));
}
