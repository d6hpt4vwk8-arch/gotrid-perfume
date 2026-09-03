import { createHash } from "node:crypto";

// MyGLS REST API (GLS Czech Republic) — spec: "MyGLS API for system
// integration" ver. 25.12.11, api.mygls.hu/docs/MyGLS_API.pdf (the same spec
// is shared verbatim across GLS's CEE countries, only the domain differs —
// CZ uses api.mygls.cz). Account created 2026-09-03, Client Number 53017674.
const API_URL = "https://api.mygls.cz";
// https://api.test.mygls.cz uses the same credential shape — useful for
// manual testing without registering a real parcel.

// MyGLS Client Number — not secret (visible in the account's own "Nastavení"
// page), hardcoded like Balíkovna's CUSTOMER_ID rather than kept in .env.
const CLIENT_NUMBER = 53017674;
const WEBSHOP_ENGINE = "GotridPerfume";

// Our own pickup/sender address — same physical address as PICKUP_ADDRESS in
// shipping.ts, split into GLS's separate Street/HouseNumber fields.
const SENDER_ADDRESS = {
  Name: "Gotrid Perfume",
  Street: "Na Jarově",
  HouseNumber: "2425/4",
  City: "Praha 3-Žižkov",
  ZipCode: "13000",
  CountryIsoCode: "CZ",
  ContactName: "Pavlo Hrytsan",
  ContactPhone: "+420735583527",
  ContactEmail: "pavlohrytsan@gmail.com",
};

export class GlsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlsError";
  }
}

function requireEnv(name: "GLS_USERNAME" | "GLS_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new GlsError(`${name} není nastavené v .env — doplňte ho, než budete moci vytvářet štítky GLS.`);
  }
  return value;
}

// Password must be SHA512-hashed before sending (APIRequestBase.Password is
// declared as byte[] in the .NET API — confirmed empirically: sending the
// hex-string digest produces a WCF deserialization error ("End element
// 'Password' expected. Found text...") because the JSON serializer expects
// a byte[] to arrive as a JSON array of 0-255 numbers, not a string).
function hashedPassword(): number[] {
  return Array.from(createHash("sha512").update(requireEnv("GLS_PASSWORD")).digest());
}

function authBase() {
  return {
    Username: requireEnv("GLS_USERNAME"),
    Password: hashedPassword(),
    ClientNumberList: [CLIENT_NUMBER],
    WebshopEngine: WEBSHOP_ENGINE,
  };
}

// This codebase's checkout only ever collects one combined "Street Number"
// string (Order.shippingStreet, e.g. "U Větřáku 480"), but GLS's Address
// class wants Street and HouseNumber as separate fields. HouseNumber isn't
// in GLS's REQUIRED list, so a parse miss just degrades to the whole string
// as Street with no house number rather than failing the request.
function splitStreetAndNumber(street: string): { Street: string; HouseNumber?: string } {
  const match = /^(.*?)\s+([\p{L}\d/-]*\d[\p{L}\d/-]*)$/u.exec(street.trim());
  if (!match) return { Street: street.trim() };
  return { Street: match[1].trim(), HouseNumber: match[2] };
}

async function callApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/ParcelService.svc/json/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GlsError(`GLS API — chyba spojení: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GlsError(`GLS API vrátilo chybu ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new GlsError("GLS API vrátilo neplatnou odpověď (není JSON).");
  }
}

interface GlsErrorInfo {
  ErrorCode: number;
  ErrorDescription: string;
}

function throwIfErrors(errors: GlsErrorInfo[] | null | undefined): void {
  if (errors && errors.length > 0) {
    throw new GlsError(errors.map((e) => `[${e.ErrorCode}] ${e.ErrorDescription}`).join("; "));
  }
}

export type CreateParcelInput = {
  recordId: string; // Order.number, used as ClientReference
  weightKg: number;
  codAmount: number | null;
  recipient: { firstName: string; surname: string; phone: string; email: string };
  address: { street: string; city: string; postalCode: string; country: string };
};

interface PrintLabelsResponse {
  Labels: string | null;
  PrintLabelsErrorList: GlsErrorInfo[] | null;
  PrintLabelsInfoList: { ParcelId: number; ParcelNumber: number }[] | null;
}

export async function createParcel(
  input: CreateParcelInput,
): Promise<{ parcelId: number; parcelNumber: string; labelPdf: Buffer }> {
  const { Street, HouseNumber } = splitStreetAndNumber(input.address.street);
  const codAmount = input.codAmount;

  const response = await callApi<PrintLabelsResponse>("PrintLabels", {
    ...authBase(),
    ParcelList: [
      {
        ClientNumber: CLIENT_NUMBER,
        ClientReference: input.recordId,
        ...(codAmount
          ? { CODAmount: codAmount, CODReference: input.recordId, CODCurrency: "CZK" }
          : {}),
        PickupAddress: SENDER_ADDRESS,
        DeliveryAddress: {
          Name: `${input.recipient.firstName} ${input.recipient.surname}`,
          Street,
          HouseNumber,
          City: input.address.city,
          ZipCode: input.address.postalCode,
          CountryIsoCode: input.address.country,
          ContactName: `${input.recipient.firstName} ${input.recipient.surname}`,
          ContactPhone: input.recipient.phone,
          ContactEmail: input.recipient.email,
        },
        ServiceList: codAmount ? [{ Code: "COD" }] : [],
        ParcelPropertyList: [{ Weight: input.weightKg, PackageType: 2 }],
      },
    ],
    PrintPosition: 1,
    ShowPrintDialog: false,
    TypeOfPrinter: "A4_4x1",
  });

  throwIfErrors(response.PrintLabelsErrorList);
  const info = response.PrintLabelsInfoList?.[0];
  if (!info || !response.Labels) {
    throw new GlsError("GLS API nevrátilo žádný štítek ani chybu.");
  }

  return {
    parcelId: info.ParcelId,
    parcelNumber: String(info.ParcelNumber),
    labelPdf: Buffer.from(response.Labels, "base64"),
  };
}

interface GetPrintedLabelsResponse {
  Labels: string | null;
  GetPrintedLabelsErrorList: GlsErrorInfo[] | null;
}

export async function reprintLabel(parcelId: number): Promise<Buffer> {
  const response = await callApi<GetPrintedLabelsResponse>("GetPrintedLabels", {
    ...authBase(),
    ParcelIdList: [parcelId],
    PrintPosition: 1,
    ShowPrintDialog: false,
    TypeOfPrinter: "A4_4x1",
  });
  throwIfErrors(response.GetPrintedLabelsErrorList);
  if (!response.Labels) {
    throw new GlsError("GLS API nevrátilo žádný štítek při opětovném tisku.");
  }
  return Buffer.from(response.Labels, "base64");
}

export const GLS_DELIVERED_STATUS_CODE = "5"; // Appendix G: "The parcel has been delivered."

interface ParcelStatus {
  StatusCode: string;
  StatusDescription: string;
  StatusDate: string;
}

interface ParcelStatuses {
  ParcelNumber: number;
  ParcelStatusList: ParcelStatus[] | null;
}

interface GetParcelListStatusesResponse {
  GetParcelListStatusesErrors: GlsErrorInfo[] | null;
  ParcelList: ParcelStatuses[] | null;
}

export async function getParcelStatuses(
  parcelNumbers: string[],
): Promise<Map<string, { statusCode: string; statusDescription: string }>> {
  const response = await callApi<GetParcelListStatusesResponse>("GetParcelListStatuses", {
    ...authBase(),
    ParcelNumberList: parcelNumbers.map(Number),
    LanguageIsoCode: "CS",
  });
  throwIfErrors(response.GetParcelListStatusesErrors);

  const result = new Map<string, { statusCode: string; statusDescription: string }>();
  for (const parcel of response.ParcelList ?? []) {
    const statuses = parcel.ParcelStatusList ?? [];
    if (statuses.length === 0) continue;
    // Most recent status = latest StatusDate.
    const latest = statuses.reduce((a, b) => (a.StatusDate > b.StatusDate ? a : b));
    result.set(String(parcel.ParcelNumber), {
      statusCode: latest.StatusCode,
      statusDescription: latest.StatusDescription,
    });
  }
  return result;
}
