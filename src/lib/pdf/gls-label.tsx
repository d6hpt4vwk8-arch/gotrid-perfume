import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

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

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Noto Sans" },
  carrier: { fontSize: 22, fontWeight: 700, marginBottom: 24 },
  section: { marginBottom: 18 },
  label: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 3 },
  name: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  line: { marginBottom: 1 },
  divider: { borderBottom: "1 solid #ccc", marginVertical: 16 },
  codBox: {
    marginTop: 4,
    marginBottom: 18,
    padding: "8 12",
    border: "1 solid #000",
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
        <Text style={styles.carrier}>GLS</Text>

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
