import QRCode from "qrcode";

/**
 * Builds the Czech "QR Platba" payload (SPAYD — Short Payment Descriptor)
 * per the spec at https://qr-platba.cz/pro-vyvojare/format-qr-platby/.
 * The variable symbol is the order number's digits (banks require VS to be numeric).
 */
export function buildSpaydPayload({
  iban,
  amount,
  variableSymbol,
  message,
}: {
  iban: string;
  amount: number;
  variableSymbol: string;
  message: string;
}): string {
  const parts = [
    "SPD",
    "1.0",
    `ACC:${iban.replace(/\s/g, "")}`,
    `AM:${amount.toFixed(2)}`,
    "CC:CZK",
    `X-VS:${variableSymbol.replace(/\D/g, "")}`,
    `MSG:${message.slice(0, 60)}`,
  ];
  return parts.join("*");
}

export async function generateQrPlatbaDataUrl(params: {
  iban: string;
  amount: number;
  variableSymbol: string;
  message: string;
}): Promise<string> {
  const payload = buildSpaydPayload(params);
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
}
