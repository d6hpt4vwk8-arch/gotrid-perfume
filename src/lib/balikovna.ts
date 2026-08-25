import { randomUUID, createHash, createHmac } from "node:crypto";

// Česká pošta nAPI B2B — ZSKService (Balíkovna parcel shipments).
// Spec: B2B-ZSKService OpenAPI (obtained from postaonline.cz → Služby pro
// firmy → Správa B2B profilu). REST/JSON, not the older SOAP B2B service.
const API_URL = "https://b2b.postaonline.cz:444/restservices/ZSKService/v1";

// Sender identifiers from Dohoda č. 2026/00278 (ID CČK 503806001).
const CUSTOMER_ID = "M17422"; // technologické číslo podavatele
const POST_CODE = "13000"; // PSČ podací pošty
const PARCEL_PREFIX = "BA"; // Balíkovna parcel code prefix

export class BalikovnaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalikovnaError";
  }
}

function requireEnv(name: "BALIKOVNA_API_TOKEN" | "BALIKOVNA_PRIVATE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new BalikovnaError(
      `${name} není nastavené v .env — doplňte ho, než budete moci vytvářet štítky Balíkovna.`,
    );
  }
  return value;
}

// HMAC_SHA256_Auth per the nAPI spec: sign
// "Authorization-Content-SHA256;Authorization-Timestamp;nonce" with the
// base64-decoded secret key, base64-encode the result.
function buildAuthHeaders(bodyJson: string) {
  const apiToken = requireEnv("BALIKOVNA_API_TOKEN");
  const privateKey = requireEnv("BALIKOVNA_PRIVATE_KEY");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const contentSha256 = createHash("sha256").update(bodyJson, "utf8").digest("hex");
  const nonce = randomUUID();
  const signedString = `${contentSha256};${timestamp};${nonce}`;
  const signature = createHmac("sha256", Buffer.from(privateKey, "base64"))
    .update(signedString, "utf8")
    .digest("base64");

  return {
    "Content-Type": "application/json",
    "Api-Token": apiToken,
    "Authorization-Timestamp": timestamp,
    "Authorization-Content-SHA256": contentSha256,
    Authorization: `CP-HMAC-SHA256 nonce="${nonce}",signature="${signature}"`,
  };
}

type ParcelAddress = {
  firstName: string;
  surname: string;
  address: {
    street?: string;
    houseNumber?: string;
    city: string;
    zipCode: string;
    isoCountry?: string;
  };
  mobilNumber?: string;
  emailAddress?: string;
};

export type CreateParcelInput = {
  recordId: string; // our order number, echoed back in the response
  weightKg: number;
  codAmount: number | null;
  recipient: ParcelAddress;
  // Balíkovna výdejní místo (BalikovnaPoint.id) selected at checkout. NOT
  // wired into the request body yet — the 1.4.0 ZSKService spec (the only
  // version this codebase could retrieve; the docs portal's newer versions
  // return "Internal error") has no field for "hold at branch" routing.
  // Confirm the right field/prefix with Balíkovna support before relying on
  // this for real pickup-point orders; until then createParcel builds a
  // normal address-delivery parcel from the order's shipping fields.
  pickupPointId?: string;
};

type ParcelServiceResponse = {
  responseHeader?: {
    resultHeader?: { responseCode: number; responseText: string };
    resultParcelData?: Array<{
      recordNumber: string;
      parcelCode: string;
      parcelStateResponse?: Array<{ responseCode: number; responseText: string }>;
    }>;
    responsePrintParams?: {
      file?: string; // base64 PDF
      printParamsResponse?: Array<{ responseCode: number; responseText: string }>;
    };
  };
};

/**
 * Creates a Balíkovna parcel and, in the same call, renders its address
 * label as a PDF (idForm 21 = independent address label).
 */
export async function createParcel(
  input: CreateParcelInput,
): Promise<{ parcelCode: string; labelPdf: Buffer }> {
  const body = {
    parcelServiceHeader: {
      parcelServiceHeaderCom: {
        transmissionDate: new Date().toISOString().slice(0, 10),
        customerID: CUSTOMER_ID,
        postCode: POST_CODE,
      },
      printParams: { idForm: 21, shiftHorizontal: 0, shiftVertical: 0 },
    },
    parcelServiceData: {
      parcelParams: {
        recordID: input.recordId,
        prefixParcelCode: PARCEL_PREFIX,
        weight: input.weightKg.toFixed(3),
        ...(input.codAmount ? { amount: input.codAmount, currency: "CZK" } : {}),
      },
      parcelAddress: {
        firstName: input.recipient.firstName,
        surname: input.recipient.surname,
        address: { isoCountry: "CZ", ...input.recipient.address },
        ...(input.recipient.mobilNumber ? { mobilNumber: input.recipient.mobilNumber } : {}),
        ...(input.recipient.emailAddress ? { emailAddress: input.recipient.emailAddress } : {}),
      },
    },
  };

  const bodyJson = JSON.stringify(body);
  const res = await fetch(`${API_URL}/parcelService`, {
    method: "POST",
    headers: buildAuthHeaders(bodyJson),
    body: bodyJson,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new BalikovnaError(`Balíkovna API vrátila HTTP ${res.status}: ${text}`);
  }

  const parsed = (await res.json()) as ParcelServiceResponse;
  const header = parsed.responseHeader;
  const resultHeader = header?.resultHeader;
  if (resultHeader && resultHeader.responseCode !== 0) {
    throw new BalikovnaError(`Balíkovna API: ${resultHeader.responseText}`);
  }

  const parcel = header?.resultParcelData?.[0];
  if (!parcel?.parcelCode) {
    throw new BalikovnaError("Balíkovna API nevrátila kód zásilky.");
  }
  const parcelError = parcel.parcelStateResponse?.find((s) => s.responseCode !== 0);
  if (parcelError) {
    throw new BalikovnaError(`Balíkovna API: ${parcelError.responseText}`);
  }

  const labelBase64 = header?.responsePrintParams?.file;
  if (!labelBase64) {
    throw new BalikovnaError("Balíkovna API nevrátila štítek.");
  }

  return { parcelCode: parcel.parcelCode, labelPdf: Buffer.from(labelBase64, "base64") };
}
