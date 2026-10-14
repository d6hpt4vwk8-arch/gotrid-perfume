import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { SHIPPING_LABELS, PAYMENT_LABELS } from "@/lib/shipping";
import { sellerForDate } from "@/lib/business-identity";
import { formatEurAmount } from "@/lib/format";
import type { Tr } from "@/i18n/tr";
import "@/lib/pdf/register-fonts";

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

export function FakturaDocument({
  order,
  tr = (k) => k,
  locale = "cs",
  itemNames,
}: {
  order: Order & { items: OrderItem[] };
  /** Slovak orders pass the Slovak dictionary; Czech (default) renders the sentences as written. */
  tr?: Tr;
  locale?: "cs" | "sk";
  /** Display names per OrderItem id (Slovak product names for Slovak orders). */
  itemNames?: Map<string, string>;
}) {
  // Resolved from the order's own date, never from "today" — a faktura is
  // re-rendered on every download, and reissuing a past sale under a company
  // that didn't exist then would be plainly wrong. See business-identity.ts.
  const seller = sellerForDate(new Date(order.createdAt));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{tr("Faktura")} — {order.number}</Text>
        <Text style={styles.subtitle}>
          {tr("Vystaveno")} {new Date(order.createdAt).toLocaleDateString(locale === "sk" ? "sk-SK" : "cs-CZ")}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>{tr("Dodavatel")}</Text>
            <Text>{seller.legalName}</Text>
            <Text>{seller.street}</Text>
            <Text>{seller.city}</Text>
            <Text>IČO: {seller.ico}</Text>
            {seller.dic && <Text>DIČ: {seller.dic}</Text>}
            <Text>{tr(seller.vatNote)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>{tr("Odběratel")}</Text>
            {order.companyName ? (
              <>
                <Text>{order.companyName}</Text>
                <Text>IČO: {order.ico}</Text>
                {order.dic && <Text>DIČ: {order.dic}</Text>}
              </>
            ) : (
              <Text>
                {order.firstName} {order.lastName}
              </Text>
            )}
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
          <Text style={styles.colName}>{tr("Položka")}</Text>
          <Text style={styles.colQty}>{tr("Ks")}</Text>
          <Text style={styles.colPrice}>{tr("Cena/ks")}</Text>
          <Text style={styles.colTotal}>{tr("Celkem")}</Text>
        </View>
        {order.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colName}>{itemNames?.get(item.id) ?? item.name}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colPrice}>{formatPrice(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatPrice(Number(item.unitPrice) * item.qty)}</Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>{tr("Zboží")}</Text>
            <Text>{formatPrice(order.itemsTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>{tr("Doprava")} ({tr(SHIPPING_LABELS[order.shippingMethod])})</Text>
            <Text>{formatPrice(order.shippingPrice)}</Text>
          </View>
          {Number(order.codSurcharge) > 0 && (
            <View style={styles.totalRow}>
              <Text>{tr("Příplatek za dobírku")}</Text>
              <Text>{formatPrice(order.codSurcharge)}</Text>
            </View>
          )}
          {Number(order.discountAmount) > 0 && (
            <View style={styles.totalRow}>
              <Text>{tr("Sleva")} {order.couponCode ? `(${order.couponCode})` : ""}</Text>
              <Text>−{formatPrice(order.discountAmount)}</Text>
            </View>
          )}
          <Text style={styles.grandTotal}>{tr("Celkem k úhradě")}: {formatPrice(order.total)}</Text>
          {order.chargedCurrency === "EUR" && order.chargedAmount && (
            <Text style={{ marginTop: 4 }}>
              {tr("Uhrazeno v eurech")}: {formatEurAmount(order.chargedAmount)}
            </Text>
          )}
        </View>

        <Text style={styles.footer}>
          {tr("Způsob platby")}: {tr(PAYMENT_LABELS[order.paymentMethod])}. {tr("Cena je konečná.")}{" "}
          {seller.dic ? `DIČ ${seller.dic}.` : tr("Dodavatel není plátcem DPH.")}
          {order.chargedCurrency === "EUR" ? ` ${tr("Částky jsou uvedeny v českých korunách (Kč); platba proběhla v eurech podle kurzu platného v den objednávky.")}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
