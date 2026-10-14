import QRCode from "qrcode";
import { encode as encodePayBySquare, CurrencyCode, PaymentOptions } from "bysquare/pay";
import type { Prisma } from "@prisma/client";
import { currentSeller } from "@/lib/business-identity";
import { formatEurAmount, formatPrice } from "@/lib/format";
import { czAccountFromIban } from "@/lib/payments/bank-account";
import { buildSpaydPayload } from "@/lib/payments/qr-platba";

/**
 * Where and how a bank-transfer order is paid. Czech orders pay in CZK to the
 * CZK account (BANK_IBAN) with a Czech "QR Platba" (SPAYD) code; Slovak orders
 * pay in EUR to the separate EUR account (BANK_IBAN_EUR, optional BANK_BIC_EUR)
 * with a "PAY by square" code — the QR standard Slovak banking apps read.
 */
export interface BankPayment {
  currency: "CZK" | "EUR";
  iban: string;
  bic: string | null;
  /** Domestic "prefix-number/bank" form — only for Czech accounts. */
  account: string | null;
  amount: number;
  amountLabel: string;
  variableSymbol: string;
  beneficiary: string;
  message: string;
}

type PayableOrder = {
  number: string;
  paymentMethod: string;
  total: Prisma.Decimal | number;
  chargedCurrency: string | null;
  chargedAmount: Prisma.Decimal | number | null;
};

/** Null when the order isn't a bank transfer or the matching account isn't configured yet. */
export function getBankPayment(order: PayableOrder): BankPayment | null {
  if (order.paymentMethod !== "BANK_TRANSFER") return null;
  const eur = order.chargedCurrency === "EUR" && Boolean(order.chargedAmount);
  const iban = (eur ? process.env.BANK_IBAN_EUR : process.env.BANK_IBAN)?.replace(/\s/g, "");
  if (!iban) return null;
  const amount = eur ? Number(order.chargedAmount) : Number(order.total);
  return {
    currency: eur ? "EUR" : "CZK",
    iban,
    bic: eur ? process.env.BANK_BIC_EUR?.replace(/\s/g, "") || null : null,
    account: eur ? null : czAccountFromIban(iban),
    amount,
    amountLabel: eur ? formatEurAmount(amount) : formatPrice(amount),
    variableSymbol: order.number.replace(/\D/g, ""),
    beneficiary: currentSeller().legalName,
    message: `Objednavka ${order.number}`,
  };
}

/** The text encoded in the QR code: SPAYD for CZK, PAY by square for EUR. */
export function buildBankQrPayload(p: BankPayment): string {
  if (p.currency === "CZK") {
    return buildSpaydPayload({ iban: p.iban, amount: p.amount, variableSymbol: p.variableSymbol, message: p.message });
  }
  return encodePayBySquare({
    payments: [
      {
        type: PaymentOptions.PaymentOrder,
        amount: Math.round(p.amount * 100) / 100,
        currencyCode: CurrencyCode.EUR,
        variableSymbol: p.variableSymbol,
        paymentNote: p.message,
        beneficiary: { name: p.beneficiary },
        bankAccounts: [{ iban: p.iban, ...(p.bic ? { bic: p.bic } : {}) }],
      },
    ],
  });
}

export async function bankQrDataUrl(p: BankPayment, width = 240): Promise<string> {
  return QRCode.toDataURL(buildBankQrPayload(p), { margin: 1, width });
}

export async function bankQrPng(p: BankPayment, width = 320): Promise<Buffer> {
  return QRCode.toBuffer(buildBankQrPayload(p), { margin: 1, width });
}
