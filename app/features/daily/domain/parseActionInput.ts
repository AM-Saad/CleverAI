import * as chrono from "chrono-node/en";
import type { ParsedResult } from "chrono-node/en";
import type { RecurrenceRuleDTO } from "../../../../shared/utils/daily.contract";
import {
  addDateKeyDays,
  compareDateKeys,
  formatDateKey,
  parseDateKey,
  toDateKey,
  weekdayForDateKey,
  type Weekday,
} from "../../../../shared/utils/daily-recurrence";

export type ActionParseTokenKind =
  | "date"
  | "time"
  | "datetime"
  | "recurrence"
  | "warning";

export type ActionParseToken = {
  start: number;
  end: number;
  kind: ActionParseTokenKind;
  label: string;
  confidence: "high" | "medium";
  accepted: boolean;
};

export type ActionParseContext = {
  referenceInstant: Date;
  timeZone: string;
  selectedDateKey: string;
  locale?: string;
};

export type ParsedActionInput = {
  raw: string;
  title: string;
  dateKey: string;
  timingMode: "ALL_DAY" | "TIMED";
  localTime: string | null;
  timezone: string;
  recurrence: RecurrenceRuleDTO | null;
  tokens: ActionParseToken[];
  issues: string[];
  summary: string;
};

type RecurrenceDraft = {
  frequency: RecurrenceRuleDTO["frequency"];
  interval: number;
  weekdays?: Weekday[];
  monthDay?: number;
  month?: number;
  start: number;
  end: number;
};

const WEEKDAY_WORD =
  "(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";

const WEEKDAY_ALIASES: Record<string, Weekday> = {
  mon: "MONDAY",
  monday: "MONDAY",
  tue: "TUESDAY",
  tues: "TUESDAY",
  tuesday: "TUESDAY",
  wed: "WEDNESDAY",
  wednesday: "WEDNESDAY",
  thu: "THURSDAY",
  thur: "THURSDAY",
  thurs: "THURSDAY",
  thursday: "THURSDAY",
  fri: "FRIDAY",
  friday: "FRIDAY",
  sat: "SATURDAY",
  saturday: "SATURDAY",
  sun: "SUNDAY",
  sunday: "SUNDAY",
};

const EXPLICIT_TIME_PATTERN =
  /\b(?:at\s+)?(?:(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|(?:[01]?\d|2[0-3]):[0-5]\d|noon|midnight)\b|\bat\s+(?:[01]?\d|2[0-3])\b/gi;
const DAYPART_PATTERN = /\b(?:morning|afternoon|evening|tonight)\b/i;
const STRONG_DATE_PATTERN =
  /\b(?:today|tomorrow|tonight|yesterday|next|this|last|in\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?))\b/i;

function overlaps(
  left: { start: number; end: number },
  right: { start: number; end: number },
) {
  return left.start < right.end && right.start < left.end;
}

function intervalFrom(value: string | undefined): number {
  if (!value) return 1;
  if (value.toLowerCase() === "other") return 2;
  return Math.max(1, Number(value) || 1);
}

function weekdaysFrom(value: string): Weekday[] {
  const matches = value.match(new RegExp(WEEKDAY_WORD, "gi")) ?? [];
  return [
    ...new Set(
      matches
        .map((word) => WEEKDAY_ALIASES[word.toLowerCase()])
        .filter((weekday): weekday is Weekday => Boolean(weekday)),
    ),
  ];
}

function findRecurrence(raw: string): RecurrenceDraft | null {
  const workday =
    /\b(?:every|each)\s+(?:(other|\d+)\s+)?(?:weekdays?|workdays?)\b/i.exec(
      raw,
    );
  if (workday) {
    return {
      frequency: "WEEKLY",
      interval: intervalFrom(workday[1]),
      weekdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      start: workday.index,
      end: workday.index + workday[0].length,
    };
  }

  const weekdayList = new RegExp(
    `\\b(?:every|each)\\s+(?:(other|\\d+)\\s+)?(${WEEKDAY_WORD}(?:\\s*(?:,|and|&)\\s*${WEEKDAY_WORD})*)\\b`,
    "i",
  ).exec(raw);
  if (weekdayList) {
    return {
      frequency: "WEEKLY",
      interval: intervalFrom(weekdayList[1]),
      weekdays: weekdaysFrom(weekdayList[2]!),
      start: weekdayList.index,
      end: weekdayList.index + weekdayList[0].length,
    };
  }

  const monthly =
    /\b(?:(?:every|each)\s+(?:(other|\d+)\s+)?months?|monthly)\b/i.exec(raw);
  if (monthly) {
    let end = monthly.index + monthly[0].length;
    const monthDay = /^\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(
      raw.slice(end),
    );
    if (monthDay) end += monthDay[0].length;
    return {
      frequency: "MONTHLY",
      interval: intervalFrom(monthly[1]),
      monthDay: monthDay
        ? Math.min(31, Math.max(1, Number(monthDay[1])))
        : undefined,
      start: monthly.index,
      end,
    };
  }

  const units =
    /\b(?:every|each)\s+(?:(other|\d+)\s+)?(days?|weeks?|years?)\b/i.exec(raw);
  if (units) {
    const unit = units[2]!.toLowerCase();
    return {
      frequency: unit.startsWith("day")
        ? "DAILY"
        : unit.startsWith("week")
          ? "WEEKLY"
          : "YEARLY",
      interval: intervalFrom(units[1]),
      start: units.index,
      end: units.index + units[0].length,
    };
  }

  const standalone =
    /\b(daily|weekly|monthly|yearly|annually|weekdays?|workdays?)\b/i.exec(raw);
  if (!standalone) return null;
  const after = raw.slice(standalone.index + standalone[0].length).trimStart();
  const forced = raw[standalone.index - 1] === "/";
  if (
    !forced &&
    after &&
    !/^(?:at\b|starting\b|from\b|until\b|for\s+\d+\s+(?:times?|occurrences?)\b)/i.test(
      after,
    )
  ) {
    return null;
  }
  const value = standalone[1]!.toLowerCase();
  return {
    frequency:
      value === "daily"
        ? "DAILY"
        : ["weekly", "weekday", "weekdays", "workday", "workdays"].includes(
              value,
            )
          ? "WEEKLY"
          : value === "monthly"
            ? "MONTHLY"
            : "YEARLY",
    interval: 1,
    weekdays: ["weekday", "weekdays", "workday", "workdays"].includes(value)
      ? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
      : undefined,
    start: standalone.index,
    end: standalone.index + standalone[0].length,
  };
}

function timezoneOffsetMinutes(instant: Date, timeZone: string): number {
  try {
    const name = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "longOffset",
    })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value;
    if (!name || name === "GMT") return 0;
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
    if (!match) return 0;
    const amount = Number(match[2]) * 60 + Number(match[3] ?? 0);
    return match[1] === "-" ? -amount : amount;
  } catch {
    return 0;
  }
}

function dateKeyFrom(components: ParsedResult["start"]): string | null {
  const year = components.get("year");
  const month = components.get("month");
  const day = components.get("day");
  if (!year || !month || !day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localTimeFrom(components: ParsedResult["start"]): string | null {
  const hour = components.get("hour");
  if (hour === null) return null;
  const minute = components.get("minute") ?? 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function hasDateMention(result: ParsedResult) {
  return ["year", "month", "day", "weekday"].some((part) =>
    result.start.isCertain(part as "year" | "month" | "day" | "weekday"),
  );
}

function hasMeaningfulTime(result: ParsedResult) {
  return (
    result.start.isCertain("hour") ||
    DAYPART_PATTERN.test(result.text) ||
    /\b(?:minutes?|hours?)\b/i.test(result.text)
  );
}

function isStandaloneMonth(result: ParsedResult) {
  return (
    result.start.isCertain("month") &&
    !result.start.isCertain("day") &&
    !result.start.isCertain("weekday")
  );
}

function isForced(raw: string, start: number) {
  return raw[start - 1] === "/";
}

function acceptDateResult(raw: string, result: ParsedResult) {
  if (isStandaloneMonth(result)) return false;
  if (isForced(raw, result.index)) return true;
  if (raw.slice(result.index + result.text.length).startsWith("'s"))
    return false;
  if (STRONG_DATE_PATTERN.test(result.text)) return true;
  const after = raw.slice(result.index + result.text.length);
  const tail = !after.replace(/[\s,.;:!?-]+/g, "");
  const prefixed = /^(?:on\s+|by\s+|due\s+)$/i.test(
    raw.slice(Math.max(0, result.index - 4), result.index),
  );
  return tail || prefixed || /^(?:on\s+)/i.test(result.text);
}

function dateLabel(dateKey: string, locale: string) {
  return formatDateKey(dateKey, locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(localTime: string, locale: string) {
  const [hour, minute] = localTime.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function commandStart(raw: string, start: number) {
  return raw[start - 1] === "/" ? start - 1 : start;
}

function addDaysToMonthStart(dateKey: string, monthOffset: number) {
  const date = parseDateKey(dateKey)!;
  return toDateKey(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1),
    ),
  );
}

function daysInMonth(dateKey: string) {
  const date = parseDateKey(dateKey)!;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function alignRecurrenceStart(
  baseDateKey: string,
  draft: RecurrenceDraft,
): string {
  if (draft.frequency === "WEEKLY" && draft.weekdays?.length) {
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = addDateKeyDays(baseDateKey, offset);
      if (draft.weekdays.includes(weekdayForDateKey(candidate)))
        return candidate;
    }
  }

  if (draft.frequency === "MONTHLY" && draft.monthDay) {
    for (let monthOffset = 0; monthOffset < 2; monthOffset += 1) {
      const monthStart = addDaysToMonthStart(baseDateKey, monthOffset);
      const candidate = addDateKeyDays(
        monthStart,
        Math.min(draft.monthDay, daysInMonth(monthStart)) - 1,
      );
      if (compareDateKeys(candidate, baseDateKey) >= 0) return candidate;
    }
  }

  if (draft.frequency === "YEARLY" && draft.month && draft.monthDay) {
    const base = parseDateKey(baseDateKey)!;
    for (let yearOffset = 0; yearOffset < 2; yearOffset += 1) {
      const year = base.getUTCFullYear() + yearOffset;
      const monthStart = toDateKey(
        new Date(Date.UTC(year, draft.month - 1, 1)),
      );
      const candidate = addDateKeyDays(
        monthStart,
        Math.min(draft.monthDay, daysInMonth(monthStart)) - 1,
      );
      if (compareDateKeys(candidate, baseDateKey) >= 0) return candidate;
    }
  }

  return baseDateKey;
}

function buildRecurrence(
  draft: RecurrenceDraft,
  startDate: string,
  ending: Pick<RecurrenceRuleDTO, "ends" | "untilDate" | "count">,
): RecurrenceRuleDTO {
  const date = parseDateKey(startDate)!;
  return {
    frequency: draft.frequency,
    interval: draft.interval,
    weekdays:
      draft.frequency === "WEEKLY"
        ? draft.weekdays?.length
          ? draft.weekdays
          : [weekdayForDateKey(startDate)]
        : undefined,
    monthDay: ["MONTHLY", "YEARLY"].includes(draft.frequency)
      ? (draft.monthDay ?? date.getUTCDate())
      : undefined,
    month:
      draft.frequency === "YEARLY"
        ? (draft.month ?? date.getUTCMonth() + 1)
        : undefined,
    missingDayPolicy: "LAST_DAY",
    ends: ending.ends,
    untilDate: ending.untilDate,
    count: ending.count,
  };
}

function recurrenceLabel(rule: RecurrenceRuleDTO) {
  const interval = rule.interval > 1 ? `Every ${rule.interval}` : "Every";
  if (rule.frequency === "DAILY")
    return `${interval} day${rule.interval > 1 ? "s" : ""}`;
  if (rule.frequency === "WEEKLY" && rule.weekdays?.length) {
    const days = rule.weekdays.map((weekday) =>
      weekday
        .slice(0, 3)
        .toLowerCase()
        .replace(/^./, (letter) => letter.toUpperCase()),
    );
    return rule.interval > 1
      ? `${interval} weeks on ${days.join(", ")}`
      : `${interval} ${days.join(", ")}`;
  }
  const unit = rule.frequency.toLowerCase().replace(/ly$/, "");
  return `${interval} ${unit}${rule.interval > 1 ? "s" : ""}`;
}

function cleanTitle(raw: string, tokens: ActionParseToken[]) {
  const removed = new Array(raw.length).fill(false);
  for (const token of tokens) {
    if (!token.accepted) continue;
    for (let index = token.start; index < token.end; index += 1)
      removed[index] = true;
  }
  return [...raw]
    .filter((_, index) => !removed[index])
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\b(?:on|at|by|due)\s*$/i, "")
    .replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "")
    .trim();
}

export function parseActionInput(
  raw: string,
  context: ActionParseContext,
): ParsedActionInput {
  const locale = context.locale ?? "en";
  const reference = {
    instant: context.referenceInstant,
    timezone: timezoneOffsetMinutes(context.referenceInstant, context.timeZone),
  };
  const tokens: ActionParseToken[] = [];
  const issues: string[] = [];
  const blocked: Array<{ start: number; end: number }> = [];
  const recurrenceDraft = findRecurrence(raw);
  let recurrenceToken: ActionParseToken | null = null;
  let targetDateKey = context.selectedDateKey;
  let localTime: string | null = null;
  let ending: Pick<RecurrenceRuleDTO, "ends" | "untilDate" | "count"> = {
    ends: "NEVER",
  };

  if (recurrenceDraft) {
    recurrenceToken = {
      start: commandStart(raw, recurrenceDraft.start),
      end: recurrenceDraft.end,
      kind: "recurrence",
      label: "Repeating action",
      confidence: "high",
      accepted: true,
    };
    tokens.push(recurrenceToken);
    blocked.push(recurrenceDraft);

    const count = /\bfor\s+(\d+)\s+(?:times?|occurrences?)\b/i.exec(raw);
    if (count && count.index > recurrenceDraft.start) {
      ending = { ends: "AFTER_COUNT", count: Number(count[1]) };
      const token = {
        start: commandStart(raw, count.index),
        end: count.index + count[0].length,
        kind: "recurrence" as const,
        label: `Ends after ${count[1]} occurrences`,
        confidence: "high" as const,
        accepted: true,
      };
      tokens.push(token);
      blocked.push(token);
    }

    const until = /\buntil\s+(.+)$/i.exec(raw);
    if (until && until.index > recurrenceDraft.start) {
      const parsed = chrono.casual
        .parse(until[1]!, reference, { forwardDate: true })
        .find(hasDateMention);
      const untilDate = parsed ? dateKeyFrom(parsed.start) : null;
      if (untilDate) {
        if (ending.ends !== "NEVER")
          issues.push("Choose either an end date or occurrence count");
        else ending = { ends: "ON_DATE", untilDate };
        const token = {
          start: commandStart(raw, until.index),
          end:
            until.index +
            until[0].indexOf(until[1]!) +
            parsed!.index +
            parsed!.text.length,
          kind: "recurrence" as const,
          label: `Ends ${dateLabel(untilDate, locale)}`,
          confidence: "high" as const,
          accepted: ending.ends === "ON_DATE",
        };
        tokens.push(token);
        blocked.push(token);
      }
    }

    const starting = /\bstarting\s+/i.exec(raw);
    const from = !starting
      ? /\bfrom\s+/i.exec(raw.slice(recurrenceDraft.end))
      : null;
    const marker = starting
      ? { index: starting.index, length: starting[0].length }
      : from
        ? {
            index: recurrenceDraft.end + from.index,
            length: from[0].length,
          }
        : null;
    if (marker) {
      const tail = raw
        .slice(marker.index + marker.length)
        .split(/\s+(?:until|for\s+\d+\s+(?:times?|occurrences?))\b/i)[0]!;
      const parsed = chrono.casual
        .parse(tail, reference, { forwardDate: true })
        .find(hasDateMention);
      const startDate = parsed ? dateKeyFrom(parsed.start) : null;
      if (parsed && startDate) {
        targetDateKey = startDate;
        if (hasMeaningfulTime(parsed)) localTime = localTimeFrom(parsed.start);
        const token = {
          start: commandStart(raw, marker.index),
          end: marker.index + marker.length + parsed.index + parsed.text.length,
          kind: hasMeaningfulTime(parsed)
            ? ("datetime" as const)
            : ("date" as const),
          label: `Starts ${dateLabel(startDate, locale)}${localTime ? ` at ${timeLabel(localTime, locale)}` : ""}`,
          confidence: "high" as const,
          accepted: true,
        };
        tokens.push(token);
        blocked.push(token);
      }
    }
  }

  const explicitTimes = [...raw.matchAll(EXPLICIT_TIME_PATTERN)]
    .map((match) => ({
      start: match.index!,
      end: match.index! + match[0].length,
      text: match[0],
    }))
    .filter(
      (candidate) => !blocked.some((range) => overlaps(candidate, range)),
    );

  if (explicitTimes.length > 1) {
    issues.push("Choose one time");
    for (const candidate of explicitTimes) {
      tokens.push({
        ...candidate,
        kind: "warning",
        label: "Multiple times found; choose one",
        confidence: "medium",
        accepted: false,
      });
    }
  } else if (explicitTimes[0]) {
    const candidate = explicitTimes[0];
    const parsed = chrono.casual.parse(candidate.text, reference, {
      forwardDate: true,
    })[0];
    const parsedTime = parsed ? localTimeFrom(parsed.start) : null;
    if (parsedTime) {
      localTime = parsedTime;
      const ambiguous = !/(?:am|pm|:|noon|midnight)/i.test(candidate.text);
      const token = {
        start: commandStart(raw, candidate.start),
        end: candidate.end,
        kind: "time" as const,
        label: `${timeLabel(parsedTime, locale)} · ${context.timeZone}`,
        confidence: ambiguous ? ("medium" as const) : ("high" as const),
        accepted: true,
      };
      tokens.push(token);
    }
  }

  const parsedDates = chrono.casual
    .parse(raw, reference, { forwardDate: true })
    .filter(hasDateMention)
    .filter((result) => !isStandaloneMonth(result))
    .filter((result) => {
      const range = {
        start: result.index,
        end: result.index + result.text.length,
      };
      return !blocked.some((item) => overlaps(range, item));
    });

  if (parsedDates.length > 1) {
    issues.push("Choose one date");
    for (const result of parsedDates) {
      tokens.push({
        start: commandStart(raw, result.index),
        end: result.index + result.text.length,
        kind: "warning",
        label: "Multiple dates found; choose one",
        confidence: "medium",
        accepted: false,
      });
    }
  } else if (parsedDates[0] && acceptDateResult(raw, parsedDates[0])) {
    const result = parsedDates[0];
    const parsedDateKey = dateKeyFrom(result.start);
    if (parsedDateKey) {
      targetDateKey = parsedDateKey;
      if (hasMeaningfulTime(result) && !localTime) {
        localTime = localTimeFrom(result.start);
      }
      const resultRange = {
        start: result.index,
        end: result.index + result.text.length,
      };
      const timeToken = tokens.find(
        (token) =>
          token.accepted &&
          token.kind === "time" &&
          overlaps(token, resultRange),
      );
      let end = timeToken ? timeToken.start : resultRange.end;
      while (end > resultRange.start && /\s/.test(raw[end - 1]!)) end -= 1;
      if (end > resultRange.start) {
        tokens.push({
          start: commandStart(raw, resultRange.start),
          end,
          kind: hasMeaningfulTime(result) && !timeToken ? "datetime" : "date",
          label: `${dateLabel(parsedDateKey, locale)}${hasMeaningfulTime(result) && localTime && !timeToken ? ` at ${timeLabel(localTime, locale)}` : ""}`,
          confidence:
            isForced(raw, result.index) || STRONG_DATE_PATTERN.test(result.text)
              ? "high"
              : "medium",
          accepted: true,
        });
      }
    }
  }

  let recurrence: RecurrenceRuleDTO | null = null;
  if (recurrenceDraft) {
    if (recurrenceDraft.frequency === "YEARLY" && !recurrenceDraft.month) {
      const date = parseDateKey(targetDateKey)!;
      recurrenceDraft.month = date.getUTCMonth() + 1;
      recurrenceDraft.monthDay = date.getUTCDate();
    }
    targetDateKey = alignRecurrenceStart(targetDateKey, recurrenceDraft);
    recurrence = buildRecurrence(recurrenceDraft, targetDateKey, ending);
    if (
      recurrence.ends === "ON_DATE" &&
      recurrence.untilDate &&
      compareDateKeys(recurrence.untilDate, targetDateKey) < 0
    ) {
      issues.push("Recurrence end date is before its first occurrence");
      recurrence.ends = "NEVER";
      delete recurrence.untilDate;
    }
    if (recurrenceToken) recurrenceToken.label = recurrenceLabel(recurrence);
  }

  const normalizedTokens = tokens
    .filter(
      (token, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.start === token.start &&
            candidate.end === token.end &&
            candidate.kind === token.kind,
        ) === index,
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const title = cleanTitle(raw, normalizedTokens);
  const timingMode = localTime ? "TIMED" : "ALL_DAY";
  const schedule = `${dateLabel(targetDateKey, locale)} · ${localTime ? timeLabel(localTime, locale) : "All day"}`;
  const summary = recurrence
    ? `${schedule} · ${recurrenceLabel(recurrence)}`
    : schedule;

  return {
    raw,
    title,
    dateKey: targetDateKey,
    timingMode,
    localTime,
    timezone: context.timeZone,
    recurrence,
    tokens: normalizedTokens,
    issues,
    summary,
  };
}
