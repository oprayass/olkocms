// Nepal Time (NPT) = UTC+5:45. Vercel runs in UTC, so all "today / this week /
// this month..." boundaries must be computed against NPT, not the server clock.
// Strategy: shift "now" by +5:45 to get NPT wall-clock, compute the boundary on
// that shifted date, then shift the boundary back by -5:45 to get the real UTC
// instant to compare stored UTC timestamps against.

const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

/** Current wall-clock date in Nepal (as a Date whose UTC fields are NPT values). */
export function nepalNow(): Date {
  return new Date(Date.now() + NPT_OFFSET_MS);
}

/** Start of "today" in Nepal, returned as a real UTC instant. */
export function nepalTodayStartUTC(): Date {
  const n = nepalNow();
  // Zero out using UTC getters (n already holds NPT wall-clock in its UTC fields).
  const nptMidnight = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0);
  return new Date(nptMidnight - NPT_OFFSET_MS);
}

export interface Range { from: Date | null; to: Date | null }

/**
 * Resolve a named period to a [from, to) range as real UTC instants,
 * computed against Nepal wall-clock. Use for filtering UTC timestamps.
 */
export function nepalPeriodRange(period: string): Range {
  const n = nepalNow();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  const d = n.getUTCDate();
  const dow = n.getUTCDay();             // 0 = Sun
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const DAY = 86400000;

  // Helper: NPT wall-clock Y/M/D -> real UTC instant.
  const utc = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm, dd, 0, 0, 0, 0) - NPT_OFFSET_MS);

  const todayStart = utc(y, m, d);

  switch (period) {
    case "today":
      return { from: todayStart, to: new Date(todayStart.getTime() + DAY) };
    case "yesterday":
      return { from: new Date(todayStart.getTime() - DAY), to: todayStart };
    case "this_week": {
      const f = new Date(todayStart.getTime() - mondayOffset * DAY);
      return { from: f, to: new Date(f.getTime() + 7 * DAY) };
    }
    case "last_week": {
      const tEnd = new Date(todayStart.getTime() - mondayOffset * DAY);
      const f = new Date(tEnd.getTime() - 7 * DAY);
      return { from: f, to: tEnd };
    }
    case "this_month":
      return { from: utc(y, m, 1), to: utc(y, m + 1, 1) };
    case "last_month":
      return { from: utc(y, m - 1, 1), to: utc(y, m, 1) };
    case "2_months_ago":
      return { from: utc(y, m - 2, 1), to: utc(y, m - 1, 1) };
    case "3_months_ago":
      return { from: utc(y, m - 3, 1), to: utc(y, m - 2, 1) };
    case "this_year":
      return { from: utc(y, 0, 1), to: utc(y + 1, 0, 1) };
    case "last_year":
      return { from: utc(y - 1, 0, 1), to: utc(y, 0, 1) };
    default:
      return { from: null, to: null };
  }
}