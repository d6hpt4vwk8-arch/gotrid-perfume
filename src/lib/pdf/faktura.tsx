import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { SHIPPING_LABELS, PAYMENT_LABELS } from "@/lib/shipping";

// The base-14 PDF fonts (Helvetica etc.) only support WinAnsi encoding and
// silently drop Czech diacritics (č, ř, ě, ů, ž…) — Noto Sans is embedded so
// faktury actually render Czech text correctly.
// Fonts live under /public (not imported statically) so Vercel's serverless
// file tracing always ships them — a path under src/ read only via fs at
// runtime could be silently dropped from the deployed function bundle.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf") },
    {
      src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Noto Sans" },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  col: { flexDirection: "column", gap: 2 },
  label: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 2 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1 solid #333",
    paddingBottom: 4,
    marginBottom: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #eee",
    paddingVertical: 4,
  },
  colName: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  totalsBox: { marginTop: 20, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", gap: 20, marginBottom: 2 },
  grandTotal: { fontSize: 13, fontWeight: 700, marginTop: 6 },
  footer: { marginTop: 30, fontSize: 8, color: "#888" },
});

export function FakturaDocument({ order }: { order: Order & { items: OrderItem[] } }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Faktura — {order.number}</Text>
        <Text style={styles.subtitle}>
          Vystaveno {new Date(order.createdAt).toLocaleDateString("cs-CZ")}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Dodavatel</Text>
            <Text>Pavlo Hrytsan</Text>
            <Text>Na Jarově 2425/4</Text>
            <Text>130 00 Praha 3-Žižkov</Text>
            <Text>IČO: 19296037</Text>
            <Text>Není plátcem DPH</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Odběratel</Text>
            <Text>
              {order.firstName} {order.lastName}
            </Text>
            {order.shippingStreet && <Text>{order.shippingStreet}</Text>}
            {(order.shippingCity || order.shippingPostalCode) && (
              <Text>
                {order.shippingPostalCode} {order.shippingCity}
              </Text>
            )}
            <Text>{order.email}</Text>
            <Text>{order.phone}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colName}>Položka</Text>
          <Text style={styles.colQty}>Ks</Text>
          <Text style={styles.colPrice}>Cena/ks</Text>
          <Text style={styles.colTotal}>Celkem</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colName}>{item.name}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colPrice}>{formatPrice(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatPrice(Number(item.unitPrice) * item.qty)}</Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>Zboží</Text>
            <Text>{formatPrice(order.itemsTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Doprava ({SHIPPING_LABELS[order.shippingMethod]})</Text>
            <Text>{formatPrice(order.shippingPrice)}</Text>
          </View>
          {Number(order.codSurcharge) > 0 && (
            <View style={styles.totalRow}>
              <Text>Příplatek za dobírku</Text>
              <Text>{formatPrice(order.codSurcharge)}</Text>
            </View>
          )}
          {Number(order.discountAmount) > 0 && (
            <View style={styles.totalRow}>
              <Text>Sleva {order.couponCode ? `(${order.couponCode})` : ""}</Text>
              <Text>−{formatPrice(order.discountAmount)}</Text>
            </View>
          )}
          <Text style={styles.grandTotal}>Celkem k úhradě: {formatPrice(order.total)}</Text>
        </View>

        <Text style={styles.footer}>
          Způsob platby: {PAYMENT_LABELS[order.paymentMethod]}. Cena je konečná, dodavatel není
          plátcem DPH.
        </Text>
      </Page>
    </Document>
  );
}
