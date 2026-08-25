import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Same font-registration approach as faktura.tsx — base-14 PDF fonts drop
// Czech diacritics, and public/ is what Vercel's serverless file tracing
// reliably ships.
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
  page: { padding: 40, fontSize: 10, fontFamily: "Noto Sans", lineHeight: 1.5 },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#666", marginBottom: 20 },
  label: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 2 },
  section: { marginBottom: 14 },
  field: { flexDirection: "row", gap: 6, marginBottom: 8 },
  fieldLabel: { width: 160 },
  fieldLine: { flex: 1, borderBottom: "1 solid #333" },
  bodyText: { marginBottom: 10 },
});

export function OdstoupeniDocument() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Formulář pro odstoupení od smlouvy</Text>
        <Text style={styles.subtitle}>
          Vyplňte tento formulář a pošlete jej zpět pouze v případě, že chcete odstoupit od
          smlouvy.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Adresát</Text>
          <Text>Pavlo Hrytsan</Text>
          <Text>Na Jarově 2425/4, 130 00 Praha 3 – Žižkov, Česká republika</Text>
          <Text>Email: pavlohrytsan@gmail.com</Text>
        </View>

        <Text style={styles.bodyText}>
          Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží:
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Číslo objednávky</Text>
          <View style={styles.fieldLine} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Datum objednání</Text>
          <View style={styles.fieldLine} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Datum obdržení</Text>
          <View style={styles.fieldLine} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Jméno a příjmení</Text>
          <View style={styles.fieldLine} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Adresa</Text>
          <View style={styles.fieldLine} />
        </View>
        <View style={{ ...styles.field, marginTop: 20 }}>
          <Text style={styles.fieldLabel}>Podpis</Text>
          <View style={styles.fieldLine} />
        </View>
        <Text style={{ fontSize: 8, color: "#888" }}>
          (pouze pokud je tento formulář zasílán v listinné podobě)
        </Text>

        <View style={{ ...styles.field, marginTop: 12 }}>
          <Text style={styles.fieldLabel}>Datum</Text>
          <View style={styles.fieldLine} />
        </View>
      </Page>
    </Document>
  );
}
