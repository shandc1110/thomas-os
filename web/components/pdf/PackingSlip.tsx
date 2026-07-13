import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PackingSlipData } from "@/types/order";
import { BRAND } from "@/lib/brand";
import { formatOrderPrice } from "@/lib/format";
import { formatWeightKg } from "@/lib/weight";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.colors.espresso,
    backgroundColor: BRAND.colors.cream,
    padding: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  brandLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 22,
    color: BRAND.colors.espresso,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 8,
    color: BRAND.colors.muted,
    letterSpacing: 0.5,
  },
  slipTitle: {
    fontFamily: "Times-Roman",
    fontSize: 16,
    color: BRAND.colors.espresso,
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  orderRef: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
    textAlign: "center",
    marginBottom: 20,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.colors.sand,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  detailLabel: {
    width: 110,
    color: BRAND.colors.muted,
    fontSize: 9,
  },
  detailValue: {
    flex: 1,
    fontSize: 9,
    color: BRAND.colors.espresso,
  },
  address: {
    fontSize: 9,
    color: BRAND.colors.espresso,
    lineHeight: 1.5,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.sand,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.colors.sand,
    paddingVertical: 8,
  },
  colItem: { flex: 3 },
  colSku: { flex: 1.2, textAlign: "center" },
  colQty: { flex: 0.6, textAlign: "center" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  thText: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: BRAND.colors.clay,
  },
  tdText: {
    fontSize: 9,
    color: BRAND.colors.espresso,
  },
  tdMuted: {
    fontSize: 9,
    color: BRAND.colors.muted,
  },
  totalsSection: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: 220,
  },
  totalLabel: {
    flex: 1,
    textAlign: "right",
    fontSize: 9,
    color: BRAND.colors.muted,
    paddingRight: 12,
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontSize: 9,
    color: BRAND.colors.espresso,
  },
  grandTotal: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    color: BRAND.colors.espresso,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BRAND.colors.sand,
    paddingTop: 12,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: BRAND.colors.muted,
    textAlign: "center",
    lineHeight: 1.4,
  },
});

type PackingSlipProps = {
  data: PackingSlipData;
  logoSrc: string;
};

export function PackingSlipDocument({ data, logoSrc }: PackingSlipProps) {
  const currency = data.currency;

  return (
    <Document title={`Packing Slip ${data.orderNumber}`} author={BRAND.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.brandLabel}>{BRAND.name}</Text>
          <Text style={styles.title}>{BRAND.name}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
        </View>

        <Text style={styles.slipTitle}>Packing Slip</Text>
        <Text style={styles.orderRef}>Order {data.orderNumber}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ship To</Text>
          <Text style={{ fontSize: 10, marginBottom: 6, fontFamily: "Times-Bold" }}>
            {data.firstName} {data.lastName}
          </Text>
          <Text style={styles.address}>{data.address}</Text>
          {data.postcode ? (
            <Text style={[styles.address, { marginTop: 4 }]}>Postcode: {data.postcode}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Order Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{data.phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>WeChat ID</Text>
            <Text style={styles.detailValue}>{data.wechatId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={styles.detailValue}>{data.paymentMethod}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Currency</Text>
            <Text style={styles.detailValue}>{data.currency}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Parcel Weight</Text>
            <Text style={styles.detailValue}>{formatWeightKg(data.totalWeightGrams)}</Text>
          </View>
          {data.notes ? (
            <View style={[styles.detailRow, { marginTop: 6 }]}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue}>{data.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Items</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colItem]}>Item</Text>
            <Text style={[styles.thText, styles.colSku]}>SKU</Text>
            <Text style={[styles.thText, styles.colQty]}>Qty</Text>
            <Text style={[styles.thText, styles.colPrice]}>Unit</Text>
            <Text style={[styles.thText, styles.colTotal]}>Subtotal</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tdText, styles.colItem]}>{item.name}</Text>
              <Text style={[styles.tdMuted, styles.colSku]}>{item.sku ?? "—"}</Text>
              <Text style={[styles.tdText, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tdText, styles.colPrice]}>
                {formatOrderPrice(item.unitPrice, currency)}
              </Text>
              <Text style={[styles.tdText, styles.colTotal]}>
                {formatOrderPrice(item.lineTotal, currency)}
              </Text>
            </View>
          ))}

          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatOrderPrice(data.subtotal, currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.grandTotal]}>Grand Total</Text>
              <Text style={[styles.totalValue, styles.grandTotal]}>
                {formatOrderPrice(data.grandTotal, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {BRAND.name} · {BRAND.tagline}
          </Text>
          <Text style={styles.footerText}>
            Thank you for your order. We will be in touch on WeChat to confirm delivery.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
