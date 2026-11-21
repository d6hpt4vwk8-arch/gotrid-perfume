/**
 * Parser for Air Bank's "Zvýšení / Snížení zůstatku na účtu …" notification e-mails (plain text, Czech).
 *
 *   zůstatek na účtu Podnikatelský účet 1 číslo 3728844015/3030 se zvýšil o částku 994,00 CZK.
 *   Příchozí úhrada z účtu Mantová Martina číslo 2838975193/0800
 *   Částka: 994,00 CZK
 *   Datum zaúčtování: 21.11.2026
 *   Variabilní symbol: 2611218357
 *   Zpráva pro příjemce: Objednavka GT261121-8357
 *   Kód transakce: 174508786448
 *
 * EUR/SEPA notifications have no "Variabilní symbol" line — the VS travels in the end-to-end reference
 * ("?/VS1875838117/SS0000000000/KS0000") and often in the message. Pure functions, no I/O.
 */

export interface BankPayment {
  direction: "credit" | "debit";
  /** Amount in major units (CZK or EUR). */
  amount: number;
  currency: string;
  /** Variable symbol from the "Variabilní symbol" line, if any. */
  variableSymbol: string | null;
  /** Variable symbol from a SEPA end-to-end reference, if any. */
  endToEndVs: string | null;
  message: string;
  counterpartyName: string | null;
  /** Air Bank's own account name, e.g. "Podnikatelský účet 1". */
  ownAccountName: string | null;
  /** Air Bank's transaction code — unique per payment, used for de-duplication. */
  transactionCode: string | null;
  bookedOn: string | null;
}

/** Unicode dashes/non-breaking spaces → plain ASCII so one regex covers every rendering of the same text. */
function normalize(text: string): string {
  return text
    .replace(/[‐-―−]/g, "-")
    .replace(/[  ]/g, " ")
    .replace(/\r/g, "");
}

function parseAmount(raw: string): number {
  // "6 675,00" / "6.675,00" / "994,00" → 6675 / 994
  return Number(raw.replace(/[\s.]/g, "").replace(",", "."));
}

/** Null when the text is not a payment notification (any other mail that reached the mailbox). */
export function parseAirBankNotification(rawText: string): BankPayment | null {
  const text = normalize(rawText);

  const head = text.match(/se\s+(zvýšil|snížil)\s+o\s+částku\s+([\d\s.]+,\d{2})\s+([A-Z]{3})/i);
  if (!head) return null;
  const direction = head[1].toLowerCase() === "zvýšil" ? "credit" : "debit";

  const amountLine = text.match(/Částka:\s*([\d\s.]+,\d{2})\s*([A-Z]{3})/i);
  const amount = parseAmount(amountLine ? amountLine[1] : head[2]);
  const currency = (amountLine ? amountLine[2] : head[3]).toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const line = (label: RegExp): string | null => {
    const m = text.match(label);
    return m ? m[1].trim() : null;
  };

  const vsLine = line(/Variabilní symbol:[ \t]*(\d+)/i);
  const endToEnd = text.match(/\/VS(\d+)\//i);
  const payer = text.match(/Příchozí\s+(?:SEPA\s+)?úhrada\s+z\s+účtu\s+(.+?)\s+číslo\s/i);

  return {
    direction,
    amount,
    currency,
    variableSymbol: vsLine,
    endToEndVs: endToEnd ? endToEnd[1] : null,
    message: line(/Zpráva pro příjemce:[ \t]*(.*)/i) ?? "",
    counterpartyName: payer ? payer[1].trim() : null,
    ownAccountName: line(/na\s+účtu\s+(.+?)\s+číslo\s/i),
    transactionCode: line(/Kód transakce:[ \t]*(\d+)/i),
    bookedOn: line(/Datum zaúčtování:[ \t]*([\d.]+)/i),
  };
}

/** True for a 10-digit string shaped like our order-number digits: yymmdd + 4 digits with a real month/day. */
function looksLikeOrderDigits(s: string): boolean {
  if (!/^\d{10}$/.test(s)) return false;
  const mm = Number(s.slice(2, 4));
  const dd = Number(s.slice(4, 6));
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

function numberFromDigits(s: string): string {
  return `GT${s.slice(0, 6)}-${s.slice(6, 10)}`;
}

/**
 * Which order number does this payment point at? Tries, in order: the variable symbol (what the QR code fills in), the SEPA
 * end-to-end VS (Slovak PAY by square), an "GT…-…" order number typed into the message, and bare order digits in the message
 * (a foreign payer who cannot enter a Czech VS — e.g. "2611174125"). Null when none looks like one of our orders.
 */
export function orderNumberFromPayment(p: Pick<BankPayment, "variableSymbol" | "endToEndVs" | "message">): string | null {
  for (const vs of [p.variableSymbol, p.endToEndVs]) {
    if (vs && looksLikeOrderDigits(vs)) return numberFromDigits(vs);
  }
  const message = normalize(p.message);
  const gt = message.match(/GT\s*(\d{6})\s*-?\s*(\d{4})/i);
  if (gt) return `GT${gt[1]}-${gt[2]}`;
  const digits = message.match(/(?<!\d)(\d{10})(?!\d)/);
  if (digits && looksLikeOrderDigits(digits[1])) return numberFromDigits(digits[1]);
  return null;
}
