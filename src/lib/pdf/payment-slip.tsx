import "./register-fonts";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Tr } from "@/i18n/tr";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Noto Sans", lineHeight: 1.5, color: "#131110" },
  brand: { fontSize: 9, letterSpacing: 1.5, color: "#8a857e", marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 10 },
  lead: { fontSize: 10, color: "#8a857e", marginBottom: 24 },
  box: { flexDirection: "row", border: "1 solid #e2e0dc", padding: 22 },
  qr: { width: 170, height: 170, marginRight: 24 },
  row: { flexDirection: "row", marginBottom: 7 },
  label: { width: 100, fontSize: 9, color: "#8a857e" },
  value: { flex: 1, fontSize: 11, fontWeight: 700 },
  note: { marginTop: 18, fontSize: 9.5, color: "#8a857e" },
});

export type PaymentSlipData = {
  orderNumber: string;
  account: string | null;
  iban: string;
  bic: string | null;
  amount: string;
  variableSymbol: string;
  qrDataUrl: string;
  sellerName: string;
  tr: Tr;
};

export function PaymentSlipDocument(d: PaymentSlipData) {
  const { tr } = d;
  const rows: [string, string][] = [
    ...(d.account ? ([[tr("Číslo účtu"), d.account]] as [string, string][]) : []),
    ["IBAN", d.iban],
    ...(d.bic ? ([["BIC", d.bic]] as [string, string][]) : []),
    [tr("Částka"), d.amount],
    [tr("Variabilní symbol"), d.variableSymbol],
    [tr("Příjemce"), d.sellerName],
  ];
  return (
    <Document title={`${tr("Platební údaje")} ${d.orderNumber}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>GOTRID PERFUME</Text>
        <Text style={styles.title}>{tr("Platební údaje k objednávce")} {d.orderNumber}</Text>
        <Text style={styles.lead}>{tr("Naskenujte QR kód v bankovní aplikaci, nebo zadejte platbu ručně.")}</Text>
        <View style={styles.box}>
          <Image src={d.qrDataUrl} style={styles.qr} />
          <View style={{ flex: 1 }}>
            {rows.map(([l, v]) => (
              <View key={l} style={styles.row}>
                <Text style={styles.label}>{l}</Text>
                <Text style={styles.value}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.note}>
          {tr("Zásilku odešleme po připsání platby. Uvedený variabilní symbol prosím nezaměňujte — podle něj platbu přiřadíme k vaší objednávce.")}
        </Text>
      </Page>
    </Document>
  );
}
