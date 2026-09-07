// Fio banka "API pro obchodníky" (https://www.fio.cz/xsd/IBSchema.xsd) — a
// read-only statement API used here to auto-confirm BANK_TRANSFER orders
// instead of the owner checking internet banking by hand. The token is
// generated in Fio's internet banking under Nastavení → API — use a
// dedicated "Pouze čtení" (read-only) token for this integration alone, not
// one shared with another tool, since the "last" endpoint below advances a
// single server-side pointer per token.
const API_BASE = "https://fioapi.fio.cz/v1/rest";

export class FioApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FioApiError";
  }
}

function requireToken(): string {
  const token = process.env.FIO_API_TOKEN;
  if (!token) {
    throw new FioApiError("FIO_API_TOKEN není nastavené v .env.");
  }
  return token;
}

type FioColumn = { value: string | number | null; name: string; id: number } | null;
type FioTransactionRaw = Record<string, FioColumn>;

export type FioIncomingPayment = {
  transactionId: string;
  date: string;
  amount: number;
  currency: string;
  variableSymbol: string | null;
  counterpartyName: string | null;
  message: string | null;
};

/** Column indices per Fio's IBSchema — stable and documented, but we key off each column's own `name` label where possible so a numbering surprise doesn't silently misread the wrong field. */
function findColumn(tx: FioTransactionRaw, byId: number, byName: string): FioColumn {
  const byIndex = tx[`column${byId}`];
  if (byIndex && byIndex.name.toLowerCase().includes(byName.toLowerCase())) return byIndex;
  // Fall back to a scan by label in case Fio ever renumbers a column.
  return Object.values(tx).find((c) => c?.name?.toLowerCase().includes(byName.toLowerCase())) ?? byIndex ?? null;
}

function parseTransaction(tx: FioTransactionRaw): FioIncomingPayment | null {
  const idCol = findColumn(tx, 22, "id pohybu");
  const dateCol = findColumn(tx, 0, "datum");
  const amountCol = findColumn(tx, 1, "objem");
  const currencyCol = findColumn(tx, 14, "měna");
  const vsCol = findColumn(tx, 5, "vs");
  const nameCol = findColumn(tx, 10, "název protiúčtu");
  const messageCol = findColumn(tx, 16, "zpráva pro příjemce");

  if (!idCol || amountCol?.value == null) return null;

  return {
    transactionId: String(idCol.value),
    date: String(dateCol?.value ?? ""),
    amount: Number(amountCol.value),
    currency: String(currencyCol?.value ?? "CZK"),
    variableSymbol: vsCol?.value != null ? String(vsCol.value) : null,
    counterpartyName: nameCol?.value != null ? String(nameCol.value) : null,
    message: messageCol?.value != null ? String(messageCol.value) : null,
  };
}

/**
 * Fetches transactions since the last call for this token (Fio tracks the
 * pointer server-side) and returns only incoming CZK payments. Rate-limited
 * by Fio to one call per ~30s per token — fine for a once-daily cron.
 */
export async function fetchNewIncomingPayments(): Promise<FioIncomingPayment[]> {
  const token = requireToken();
  const res = await fetch(`${API_BASE}/last/${token}/transactions.json`);
  if (!res.ok) {
    throw new FioApiError(`Fio API vrátila HTTP ${res.status}.`);
  }
  const json = (await res.json()) as {
    accountStatement?: { transactionList?: { transaction?: FioTransactionRaw[] } };
  };
  const rawTransactions = json.accountStatement?.transactionList?.transaction ?? [];

  return rawTransactions
    .map(parseTransaction)
    .filter((tx): tx is FioIncomingPayment => tx !== null && tx.amount > 0 && tx.currency === "CZK");
}
