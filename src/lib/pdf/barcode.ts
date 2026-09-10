import bwipjs from "bwip-js";

/** Renders a Code128 barcode (the symbology GLS's own tracking numbers use) as a PNG data URI. */
export async function code128DataUri(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 3,
    height: 15,
    includetext: false,
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}
