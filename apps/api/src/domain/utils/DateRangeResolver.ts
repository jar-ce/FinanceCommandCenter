/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Date Range Resolver with Timezone Support (Phase 16)
 */

import { DateRangeFilter, DateRangePreset, ResolvedUtcDateRange } from '@finance-command-center/shared-types';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
// IST offset in milliseconds: +5:30 = +19,800,000 ms
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Converts a calendar date string (YYYY-MM-DD or ISO) in local timezone to UTC ISO string.
 * @param dateStr Date string (YYYY-MM-DD)
 * @param isEndOfDay If true, sets time to 23:59:59.999 local; else 00:00:00.000 local
 * @param timezone Timezone string (default Asia/Kolkata)
 */
export function calendarDateToUtcIso(dateStr: string, isEndOfDay: boolean, _timezone: string = DEFAULT_TIMEZONE): string {

  // Extract YYYY, MM, DD
  let year: number;
  let month: number;
  let day: number;

  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date string: ${dateStr}`);
    }
    // If full ISO was passed, adjust to timezone components
    const tzDate = new Date(d.getTime() + IST_OFFSET_MS);
    year = tzDate.getUTCFullYear();
    month = tzDate.getUTCMonth();
    day = tzDate.getUTCDate();
  } else {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid date format (expected YYYY-MM-DD): ${dateStr}`);
    }
    year = parts[0];
    month = parts[1] - 1; // 0-indexed
    day = parts[2];
  }

  const hours = isEndOfDay ? 23 : 0;
  const minutes = isEndOfDay ? 59 : 0;
  const seconds = isEndOfDay ? 59 : 0;
  const ms = isEndOfDay ? 999 : 0;

  // Local timestamp in target timezone as if UTC
  const localUtcMs = Date.UTC(year, month, day, hours, minutes, seconds, ms);
  // Subtract offset to get true UTC timestamp
  const trueUtcMs = localUtcMs - IST_OFFSET_MS;

  return new Date(trueUtcMs).toISOString();
}

/**
 * Helper to format year, month (0-indexed), day as YYYY-MM-DD string
 */
function formatDateString(y: number, m: number, d: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/**
 * Returns current date components in user calendar timezone (Asia/Kolkata)
 */
function getLocalNowComponents(refDate?: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const now = refDate || new Date();
  const localDate = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth(), // 0-indexed
    day: localDate.getUTCDate(),
    dayOfWeek: localDate.getUTCDay(), // 0 = Sunday, 1 = Monday
  };
}

/**
 * Main resolver method to turn filter params into deterministic UTC ISO boundaries.
 */
export function resolveDateRange(filter?: DateRangeFilter, referenceDate?: Date): ResolvedUtcDateRange {
  const timezone = filter?.timezone || DEFAULT_TIMEZONE;
  const preset: DateRangePreset = filter?.preset || (filter?.fromDate || filter?.toDate ? 'CUSTOM' : 'ALL_TIME');

  if (preset === 'CUSTOM') {
    const fromStr = filter?.fromDate || '1970-01-01';
    const toStr = filter?.toDate || '2099-12-31';

    const fromUtc = calendarDateToUtcIso(fromStr, false, timezone);
    const toUtc = calendarDateToUtcIso(toStr, true, timezone);

    if (new Date(fromUtc).getTime() > new Date(toUtc).getTime()) {
      throw new Error(`Invalid date range: fromDate (${fromStr}) is after toDate (${toStr})`);
    }

    return {
      fromUtc,
      toUtc,
      preset: 'CUSTOM',
      timezone,
    };
  }

  const now = getLocalNowComponents(referenceDate);
  let fromStr: string;
  let toStr: string;

  switch (preset) {
    case 'TODAY': {
      fromStr = formatDateString(now.year, now.month, now.day);
      toStr = fromStr;
      break;
    }
    case 'YESTERDAY': {
      const yesterday = new Date(Date.UTC(now.year, now.month, now.day - 1));
      fromStr = formatDateString(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate());
      toStr = fromStr;
      break;
    }
    case 'CURRENT_WEEK': {
      // Monday is start of week. dayOfWeek: 0 = Sun (offset 6), 1 = Mon (offset 0), 2 = Tue (offset 1)...
      const diffToMon = (now.dayOfWeek + 6) % 7;
      const monday = new Date(Date.UTC(now.year, now.month, now.day - diffToMon));
      const sunday = new Date(Date.UTC(now.year, now.month, now.day - diffToMon + 6));
      fromStr = formatDateString(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
      toStr = formatDateString(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate());
      break;
    }
    case 'PREVIOUS_WEEK': {
      const diffToMon = (now.dayOfWeek + 6) % 7;
      const prevMonday = new Date(Date.UTC(now.year, now.month, now.day - diffToMon - 7));
      const prevSunday = new Date(Date.UTC(now.year, now.month, now.day - diffToMon - 1));
      fromStr = formatDateString(prevMonday.getUTCFullYear(), prevMonday.getUTCMonth(), prevMonday.getUTCDate());
      toStr = formatDateString(prevSunday.getUTCFullYear(), prevSunday.getUTCMonth(), prevSunday.getUTCDate());
      break;
    }
    case 'CURRENT_MONTH': {
      const firstDay = new Date(Date.UTC(now.year, now.month, 1));
      const lastDay = new Date(Date.UTC(now.year, now.month + 1, 0));
      fromStr = formatDateString(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate());
      toStr = formatDateString(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate());
      break;
    }
    case 'PREVIOUS_MONTH': {
      const firstDay = new Date(Date.UTC(now.year, now.month - 1, 1));
      const lastDay = new Date(Date.UTC(now.year, now.month, 0));
      fromStr = formatDateString(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate());
      toStr = formatDateString(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate());
      break;
    }
    case 'CURRENT_QUARTER': {
      const qStartMonth = Math.floor(now.month / 3) * 3;
      const firstDay = new Date(Date.UTC(now.year, qStartMonth, 1));
      const lastDay = new Date(Date.UTC(now.year, qStartMonth + 3, 0));
      fromStr = formatDateString(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate());
      toStr = formatDateString(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate());
      break;
    }
    case 'PREVIOUS_QUARTER': {
      const currentQStartMonth = Math.floor(now.month / 3) * 3;
      const firstDay = new Date(Date.UTC(now.year, currentQStartMonth - 3, 1));
      const lastDay = new Date(Date.UTC(now.year, currentQStartMonth, 0));
      fromStr = formatDateString(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate());
      toStr = formatDateString(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate());
      break;
    }
    case 'CURRENT_YEAR': {
      fromStr = `${now.year}-01-01`;
      toStr = `${now.year}-12-31`;
      break;
    }
    case 'PREVIOUS_YEAR': {
      fromStr = `${now.year - 1}-01-01`;
      toStr = `${now.year - 1}-12-31`;
      break;
    }
    case 'ALL_TIME':
    default: {
      fromStr = '1970-01-01';
      toStr = '2099-12-31';
      break;
    }
  }

  const fromUtc = calendarDateToUtcIso(fromStr, false, timezone);
  const toUtc = calendarDateToUtcIso(toStr, true, timezone);

  return {
    fromUtc,
    toUtc,
    preset,
    timezone,
  };
}
