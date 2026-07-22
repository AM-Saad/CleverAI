export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type RecurrenceEnd = "NEVER" | "ON_DATE" | "AFTER_COUNT";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: Weekday[];
  monthDay?: number;
  month?: number;
  missingDayPolicy: "LAST_DAY";
  ends: RecurrenceEnd;
  untilDate?: string;
  count?: number;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(dateKey: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  )
    return null;
  return value;
}

export function isDateKey(dateKey: string): boolean {
  return Boolean(parseDateKey(dateKey));
}

export function formatDateKey(
  dateKey: string,
  locales?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const value = parseDateKey(dateKey);
  if (!value) return dateKey;
  return value.toLocaleDateString(locales, { ...options, timeZone: "UTC" });
}

export function toDateKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDateKeyDays(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  if (!date) throw new Error(`Invalid date key: ${dateKey}`);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateKey(date);
}

export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function daysBetween(from: string, to: string): number {
  const left = parseDateKey(from);
  const right = parseDateKey(to);
  if (!left || !right) throw new Error("Invalid date key");
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

export function weekdayForDateKey(dateKey: string): Weekday {
  const date = parseDateKey(dateKey);
  if (!date) throw new Error(`Invalid date key: ${dateKey}`);
  // UTC Sunday is 0. Convert to the Monday-first domain order.
  return WEEKDAYS[(date.getUTCDay() + 6) % 7]!;
}

function monthIndex(dateKey: string): number {
  const value = parseDateKey(dateKey)!;
  return value.getUTCFullYear() * 12 + value.getUTCMonth();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function startOfMondayWeek(dateKey: string): string {
  const weekdayIndex = WEEKDAYS.indexOf(weekdayForDateKey(dateKey));
  return addDateKeyDays(dateKey, -weekdayIndex);
}

function baseRuleMatches(
  startDate: string,
  rule: RecurrenceRule,
  dateKey: string,
): boolean {
  if (compareDateKeys(dateKey, startDate) < 0) return false;
  if (
    rule.ends === "ON_DATE" &&
    rule.untilDate &&
    compareDateKeys(dateKey, rule.untilDate) > 0
  ) {
    return false;
  }

  const interval = Math.max(1, rule.interval || 1);
  const start = parseDateKey(startDate)!;
  const target = parseDateKey(dateKey)!;

  if (rule.frequency === "DAILY") {
    return daysBetween(startDate, dateKey) % interval === 0;
  }

  if (rule.frequency === "WEEKLY") {
    const startWeek = startOfMondayWeek(startDate);
    const targetWeek = startOfMondayWeek(dateKey);
    const weekDistance = Math.floor(daysBetween(startWeek, targetWeek) / 7);
    const weekdays = rule.weekdays?.length
      ? rule.weekdays
      : [weekdayForDateKey(startDate)];
    return (
      weekDistance % interval === 0 &&
      weekdays.includes(weekdayForDateKey(dateKey))
    );
  }

  if (rule.frequency === "MONTHLY") {
    const monthDistance = monthIndex(dateKey) - monthIndex(startDate);
    if (monthDistance % interval !== 0) return false;
    const desiredDay = rule.monthDay ?? start.getUTCDate();
    const effectiveDay = Math.min(
      desiredDay,
      daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1),
    );
    return target.getUTCDate() === effectiveDay;
  }

  const yearDistance = target.getUTCFullYear() - start.getUTCFullYear();
  if (yearDistance % interval !== 0) return false;
  const desiredMonth = rule.month ?? start.getUTCMonth() + 1;
  if (target.getUTCMonth() + 1 !== desiredMonth) return false;
  const desiredDay = rule.monthDay ?? start.getUTCDate();
  const effectiveDay = Math.min(
    desiredDay,
    daysInMonth(target.getUTCFullYear(), desiredMonth),
  );
  return target.getUTCDate() === effectiveDay;
}

export function recurrenceMatchesDate(
  startDate: string,
  rule: RecurrenceRule | null | undefined,
  dateKey: string,
): boolean {
  if (!isDateKey(startDate) || !isDateKey(dateKey)) return false;
  if (!rule) return dateKey === startDate;
  if (!baseRuleMatches(startDate, rule, dateKey)) return false;
  if (rule.ends !== "AFTER_COUNT" || !rule.count) return true;

  let seen = 0;
  let cursor = startDate;
  const maxDays = Math.max(1, daysBetween(startDate, dateKey) + 1);
  for (let index = 0; index < maxDays; index += 1) {
    if (baseRuleMatches(startDate, { ...rule, ends: "NEVER" }, cursor)) {
      seen += 1;
      if (cursor === dateKey) return seen <= rule.count;
      if (seen >= rule.count) return false;
    }
    cursor = addDateKeyDays(cursor, 1);
  }
  return false;
}

export function occurrenceKey(
  actionItemId: string,
  originalDateKey: string,
): string {
  return `${actionItemId}:${originalDateKey}`;
}

export function dateKeyInTimeZone(
  instant: Date = new Date(),
  timeZone = "UTC",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
