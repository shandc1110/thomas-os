import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDocumentData } from "@/types/consolidation";
import { BRAND } from "@/lib/brand";
import { formatOrderPrice } from "@/lib/format";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BRAND.colors.espresso,
    backgroundColor: "#FFFFFF",
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 18,
  },
  logo: {
    width: 160,
    height: 42,
    marginBottom: 8,
  },
  company: {
    fontSize: 8,
    color: BRAND.colors.muted,
    lineHeight: 1.4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.sand,
    paddingBottom: 10,
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 22,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 8,
    color: BRAND.colors.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: {
    fontSize: 10,
    marginBottom: 4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 18,
  },
  col: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
    marginBottom: 6,
  },
  body: {
    fontSize: 9,
    lineHeight: 1.45,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.espresso,
    paddingBottom: 6,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.colors.sand,
    paddingVertical: 6,
  },
  colItem: { flex: 3.2, paddingRight: 6 },
  colSku: { flex: 1.4, paddingRight: 4 },
  colQty: { width: 36, textAlign: "right" },
  colPrice: { width: 64, textAlign: "right" },
  colTotal: { width: 72, textAlign: "right" },
  th: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
  },
  totals: {
    marginTop: 14,
    alignSelf: "flex-end",
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 9, color: BRAND.colors.muted },
  totalValue: { fontSize: 9 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BRAND.colors.espresso,
    paddingTop: 6,
    marginTop: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  payment: {
    marginTop: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.sand,
  },
  note: {
    marginTop: 16,
    fontSize: 8,
    color: BRAND.colors.muted,
    lineHeight: 1.4,
  },
  orderRefs: {
    marginBottom: 12,
    fontSize: 8,
    color: BRAND.colors.muted,
  },
});

type Props = {
  data: InvoiceDocumentData;
  logoSrc: string;
};

export function InvoiceDocument({ data, logoSrc }: Props) {
  const currency = data.currency;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.company}>Chosen by Chloe · Jacksonway Limited</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Invoice</Text>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>{formatDisplayDate(data.invoiceDate)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Text style={styles.body}>{data.customerName}</Text>
            <Text style={styles.body}>{data.customerEmail}</Text>
            {data.phone ? <Text style={styles.body}>{data.phone}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Delivery To</Text>
            <Text style={styles.body}>{data.customerName}</Text>
            <Text style={styles.body}>{data.deliveryAddress}</Text>
            {data.postcode ? <Text style={styles.body}>{data.postcode}</Text> : null}
            <Text style={styles.body}>United Kingdom</Text>
          </View>
        </View>

        {data.orderReferences.length > 0 ? (
          <Text style={styles.orderRefs}>
            Order references: {data.orderReferences.join(", ")}
          </Text>
        ) : null}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colItem]}>Item</Text>
          <Text style={[styles.th, styles.colSku]}>SKU</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colPrice]}>Price</Text>
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
        </View>

        {data.lines.map((line, idx) => (
          <View key={`${line.sku ?? "x"}-${idx}`} style={styles.tableRow} wrap={false}>
            <Text style={[styles.body, styles.colItem]}>{line.description}</Text>
            <Text style={[styles.body, styles.colSku]}>{line.sku ?? "—"}</Text>
            <Text style={[styles.body, styles.colQty]}>{line.quantity}</Text>
            <Text style={[styles.body, styles.colPrice]}>
              {formatOrderPrice(line.unitPrice, currency)}
            </Text>
            <Text style={[styles.body, styles.colTotal]}>
              {formatOrderPrice(line.lineTotal, currency)}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatOrderPrice(data.merchandiseTotal, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={styles.totalValue}>
              {formatOrderPrice(data.discountTotal, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery</Text>
            <Text style={styles.totalValue}>
              {formatOrderPrice(data.deliveryTotal, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT</Text>
            <Text style={styles.totalValue}>
              {formatOrderPrice(data.vatTotal, currency)}
            </Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>
              {formatOrderPrice(data.grandTotal, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.payment}>
          <Text style={styles.sectionLabel}>Payment</Text>
          <Text style={styles.body}>
            Payment status: {data.paymentStatusLabel}
          </Text>
          <Text style={styles.body}>
            Payment method: {data.paymentMethod ?? "—"}
          </Text>
        </View>

        <Text style={styles.note}>
          {data.notes
            ? data.notes
            : "Thank you for choosing Chosen by Chloe."}
        </Text>
      </Page>
    </Document>
  );
}

function formatDisplayDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
