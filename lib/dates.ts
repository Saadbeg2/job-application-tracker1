export const CHICAGO_TIMEZONE = "America/Chicago";

function keyFromParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute date key");
  }

  return `${year}-${month}-${day}`;
}

export function toDateKeyInTimezone(date: Date, timezone: string) {
  return keyFromParts(date, timezone);
}

export function toChicagoDateKey(date: Date) {
  return toDateKeyInTimezone(date, CHICAGO_TIMEZONE);
}

export function getTodayChicagoDateKey(now: Date = new Date()) {
  return toChicagoDateKey(now);
}

export function dateOnlyKeyFromStoredDate(date: Date) {
  // `dateApplied` is a date-only field in app semantics. Use UTC date component as canonical key.
  return date.toISOString().slice(0, 10);
}

export function chicagoDateKeyToStoredDate(dateKey: string) {
  // Store at UTC noon to keep the same YYYY-MM-DD in all common local timezones.
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function dateToChicagoStoredDate(date: Date) {
  return chicagoDateKeyToStoredDate(toChicagoDateKey(date));
}

export function parseDateInputToStoredDateInChicago(input: string) {
  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return chicagoDateKeyToStoredDate(trimmed);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value");
  }

  return dateToChicagoStoredDate(parsed);
}
