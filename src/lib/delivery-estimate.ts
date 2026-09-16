const WEEKDAY_DATE_FORMAT = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Estimated delivery date for an order placed right now: if today is a
 * weekend, processing starts the next business day; then `businessDays`
 * more business days for picking/shipping (Sat/Sun don't count). With the
 * default of 3, a Monday order lands Thursday, a Friday order lands
 * Wednesday. Bumped from 2 (2026-09-16): some items require a personal
 * sourcing trip rather than an online reorder, and the margin doesn't
 * support promising next-day-style speed on those.
 */
export function estimateDeliveryDate(businessDays = 3, from: Date = new Date()): Date {
  const date = new Date(from);
  while (isWeekend(date)) date.setDate(date.getDate() + 1);

  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) added++;
  }
  return date;
}

export function formatDeliveryEstimate(date: Date): string {
  return WEEKDAY_DATE_FORMAT.format(date);
}
