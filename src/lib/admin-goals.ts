/**
 * Owner's monthly targets for the dashboard progress bars, keyed "YYYY-MM". Kept in code (not the database) on purpose:
 * changing a target is a one-line edit asked of the assistant, and it needs no schema change. A month without an entry
 * falls back to DEFAULT_GOAL; `null` fields hide that bar.
 */
export interface MonthlyGoal {
  /** Net profit target in Kč (after goods, shipping and card fees — same figure as the order pages). */
  profit: number | null;
  orders: number | null;
}

const GOALS: Record<string, MonthlyGoal> = {
  // Owner's target for November 2026: 30 000 Kč net profit (no order-count target set).
  "2026-11": { profit: 30000, orders: null },
};

const DEFAULT_GOAL: MonthlyGoal = { profit: null, orders: null };

export function getMonthlyGoal(month: string): MonthlyGoal {
  return GOALS[month] ?? DEFAULT_GOAL;
}
