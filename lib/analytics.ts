import { dateOnlyKeyFromStoredDate, getTodayChicagoDateKey } from "@/lib/dates";

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekdayIndexFromDateKey(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return day;
}

function parseTodayOverride() {
  const raw = process.env.ANALYTICS_TODAY_OVERRIDE?.trim();
  if (!raw) return null;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  return valid ? raw : null;
}

function debugEnabled() {
  return process.env.ANALYTICS_DEBUG === "true";
}

function getChicagoTodayKey() {
  const override = parseTodayOverride();
  if (override) return override;
  return getTodayChicagoDateKey();
}

export function getChicagoTodayAndWeekRange() {
  const todayKey = getChicagoTodayKey();
  const weekdayIndex = getWeekdayIndexFromDateKey(todayKey);
  const weekStartKey = addDaysToDateKey(todayKey, -weekdayIndex);
  const weekEndKey = addDaysToDateKey(weekStartKey, 6);

  return { todayKey, weekStartKey, weekEndKey };
}

export function countApplicationsForTodayAndWeek(
  applications: Array<{ id: number; company: string; dateApplied: Date }>,
) {
  const { todayKey, weekStartKey, weekEndKey } = getChicagoTodayAndWeekRange();

  let applicationsToday = 0;
  let applicationsThisWeek = 0;

  for (const application of applications) {
    const key = dateOnlyKeyFromStoredDate(application.dateApplied);
    const isToday = key === todayKey;
    const inWeek = key >= weekStartKey && key <= weekEndKey;

    if (isToday) {
      applicationsToday += 1;
    }
    if (inWeek) {
      applicationsThisWeek += 1;
    }

    if (debugEnabled()) {
      console.log(
        `[analytics] appId=${application.id} company=${application.company} dateKey=${key} isToday=${isToday} inWeek=${inWeek}`,
      );
    }
  }

  if (debugEnabled()) {
    console.log(
      `[analytics] chicagoTodayKey=${todayKey} weekStart=${weekStartKey} weekEnd=${weekEndKey} override=${parseTodayOverride() ?? "none"}`,
    );
  }

  return { applicationsToday, applicationsThisWeek, todayKey, weekStartKey, weekEndKey };
}
