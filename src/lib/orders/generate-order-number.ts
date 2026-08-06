function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** e.g. "GT260803-4821" — date-prefixed with a random suffix; uniqueness is enforced by the DB and a retry loop on insert. */
export function generateOrderNumber(): string {
  const now = new Date();
  const datePart = `${pad(now.getFullYear() % 100, 2)}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  const randomPart = pad(Math.floor(Math.random() * 10000), 4);
  return `GT${datePart}-${randomPart}`;
}
