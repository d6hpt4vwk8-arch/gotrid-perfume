import path from "node:path";
import { Document, Page, Text, View, Image, Svg, Path, StyleSheet, Font } from "@react-pdf/renderer";

// GLS's own label PDF (TypeOfPrinter "A4_4x1", the only format whose page
// shape survives this printer's driver un-mangled — see gls.ts) lays each
// label out in a narrow quarter-of-a-page slot designed for cutting off an
// A4 sheet, not for a continuous label roll: on a longer label (anything
// with a Dobírka/COD line) content got cut off. Zásilkovna's own label PDF
// — a single label's worth of content on a full A4 page — is the one shape
// confirmed to print correctly here, so this builds a same-shaped page
// ourselves instead of depending on GLS's fixed narrow layout, generating
// the Code128 tracking barcode locally (bwip-js) rather than relying on the
// one GLS embeds in its own PDF.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});

const INK = "#131110";

// Same paths as public/logo.svg (the ◇ mark in the site header), reproduced
// as native PDF vector shapes rather than a rasterized <Image> — stays crisp
// at any print size and needs no separate asset file. Its finest details (a
// thin double-outline diamond around a small "G" accent) only read clearly
// above roughly 40pt — confirmed live, the same paths rendered as a barely
// visible speck at 24–34pt — so BrandMark's default matches the ~40px this
// mark already uses in the site header rather than shrinking it further.
const LOGO_PATHS = [
  "M 66.699219 72.300781 C 66.699219 69.054688 68.503906 66.183594 72.417969 66.183594 C 74.757812 66.183594 76.628906 67.371094 77.589844 69.585938 L 75.699219 70.375 C 75.152344 68.761719 73.914062 68.039062 72.402344 68.039062 C 69.894531 68.039062 68.8125 70.015625 68.8125 72.214844 C 68.8125 74.570312 69.894531 76.492188 72.4375 76.492188 C 74.136719 76.492188 75.511719 75.34375 75.753906 73.539062 L 73.054688 73.539062 L 73.054688 71.820312 L 77.8125 71.820312 L 77.8125 78.226562 L 76.128906 78.226562 L 75.941406 76.5625 C 75.152344 77.660156 74.015625 78.398438 72.4375 78.398438 C 68.535156 78.398438 66.699219 75.546875 66.699219 72.300781",
  "M 81.398438 75.753906 L 77.824219 74.035156 L 77.824219 77.265625 Z M 75.710938 71.820312 L 77.789062 71.820312 L 83.339844 74.707031 L 83.339844 76.855469 L 77.824219 79.292969 L 77.824219 83.847656 L 75.710938 83.847656 Z M 75.710938 71.820312",
  "M 57.800781 75.015625 L 75.019531 92.234375 L 92.238281 75.015625 L 75.019531 57.796875 Z M 75.019531 93.429688 L 56.605469 75.015625 L 75.019531 56.601562 L 93.433594 75.015625 Z M 75.019531 93.429688",
  "M 54.828125 75.015625 L 75.019531 95.207031 L 95.210938 75.015625 L 75.019531 54.824219 Z M 75.019531 96.609375 L 53.425781 75.015625 L 75.019531 53.421875 L 96.613281 75.015625 Z M 75.019531 96.609375",
];

function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 150 150" style={{ width: size, height: size }}>
      {LOGO_PATHS.map((d, i) => (
        <Path key={i} d={d} fill={INK} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Noto Sans", color: INK },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 17, fontWeight: 700, letterSpacing: 0.5 },
  carrierBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#fff",
    backgroundColor: INK,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  headerRule: { borderBottom: "2 solid " + INK, marginBottom: 26 },
  section: { marginBottom: 18 },
  label: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 3 },
  name: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  line: { marginBottom: 1 },
  divider: { borderBottom: "1 solid #ccc", marginVertical: 16 },
  codBox: {
    marginTop: 4,
    marginBottom: 18,
    padding: "8 12",
    border: "1 solid " + INK,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  codLabel: { fontSize: 8, textTransform: "uppercase", color: "#666" },
  codAmount: { fontSize: 16, fontWeight: 700 },
  barcodeBlock: { alignItems: "center", marginTop: 20 },
  trackingNumber: { fontSize: 14, fontWeight: 700, letterSpacing: 1, marginTop: 6 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, fontSize: 9, color: "#666" },
});

export function GlsLabelDocument({
  trackingNumber,
  weightKg,
  codAmount,
  pickupPointName,
  senderName,
  senderAddress,
  recipientName,
  recipientAddress,
  recipientPhone,
  barcodeDataUri,
}: {
  trackingNumber: string;
  weightKg: number;
  codAmount: number | null;
  /** Set for a GLS_MISTO parcel — printed instead of a street address. */
  pickupPointName?: string | null;
  senderName: string;
  senderAddress: string[];
  recipientName: string;
  recipientAddress: string[];
  recipientPhone: string;
  barcodeDataUri: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <BrandMark />
            <Text style={styles.brandName}>Gotrid Perfume</Text>
          </View>
          <Text style={styles.carrierBadge}>GLS</Text>
        </View>
        <View style={styles.headerRule} />

        <View style={styles.section}>
          <Text style={styles.label}>Odesílatel</Text>
          <Text style={styles.name}>{senderName}</Text>
          {senderAddress.map((line, i) => (
            <Text key={i} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>{pickupPointName ? "Výdejní místo" : "Příjemce"}</Text>
          {pickupPointName && <Text style={styles.name}>{pickupPointName}</Text>}
          <Text style={pickupPointName ? styles.line : styles.name}>{recipientName}</Text>
          {recipientAddress.map((line, i) => (
            <Text key={i} style={styles.line}>
              {line}
            </Text>
          ))}
          <Text style={styles.line}>{recipientPhone}</Text>
        </View>

        {codAmount !== null && (
          <View style={styles.codBox}>
            <Text style={styles.codLabel}>Dobírka</Text>
            <Text style={styles.codAmount}>{codAmount.toFixed(0)} Kč</Text>
          </View>
        )}

        <View style={styles.barcodeBlock}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
          <Image src={barcodeDataUri} style={{ width: 260, height: 60 }} />
          <Text style={styles.trackingNumber}>{trackingNumber}</Text>
        </View>

        <View style={styles.meta}>
          <Text>Hmotnost: {weightKg.toFixed(1)} kg</Text>
          <Text>{new Date().toLocaleDateString("cs-CZ")}</Text>
        </View>
      </Page>
    </Document>
  );
}
