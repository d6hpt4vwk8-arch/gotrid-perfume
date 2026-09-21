import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { sellerForDate } from "@/lib/business-identity";
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
  grandTotal: { fontSize: 13, fontWeight: 700, marginTop: 6, color: "#b91c1c" },
  footer: { marginTop: 30, fontSize: 8, color: "#888" },
});

// The order model has no partial-refund tracking (see refundedAt's comment
// in schema.prisma) — REFUNDED is all-or-nothing, so the credit note always
// reverses the full original faktura rather than a partial line-item subset.
export function DobropisDocument({ order }: { order: Order & { items: OrderItem[] } }) {
  const issuedAt = order.refundedAt ?? order.updatedAt;
  // Dated from the sale itself, same reasoning as FakturaDocument — this
  // reverses that specific faktura, so it must name the entity that was
  // actually party to it, not whoever is selling today.
  const seller = sellerForDate(new Date(order.createdAt));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Dobropis k faktuře {order.number}</Text>
        <Text style={styles.subtitle}>
          Vystaveno {issuedAt.toLocaleDateString("cs-CZ")} · Důvod: vrácení objednávky
          zákazníkovi (stav „Vrácená“)
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Dodavatel</Text>
            <Text>{seller.legalName}</Text>
            <Text>{seller.street}</Text>
            <Text>{seller.city}</Text>
            <Text>IČO: {seller.ico}</Text>
            {seller.dic && <Text>DIČ: {seller.dic}</Text>}
            <Text>{seller.vatNote}</Text>
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
            <Text style={styles.colQty}>−{item.qty}</Text>
            <Text style={styles.colPrice}>{formatPrice(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>−{formatPrice(Number(item.unitPrice) * item.qty)}</Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <Text style={styles.grandTotal}>Vráceno celkem: −{formatPrice(order.total)}</Text>
        </View>

        <Text style={styles.footer}>
          Tento dobropis stornuje fakturu {order.number} v plné výši. Původní fakturu najdete v
          administraci u téže objednávky.
        </Text>
      </Page>
    </Document>
  );
}
