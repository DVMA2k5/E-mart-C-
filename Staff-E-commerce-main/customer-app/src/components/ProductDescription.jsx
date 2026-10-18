import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { parseProductDescription } from "../utils/productDescription";

export default function ProductDescription({ value, fallback }) {
  const document = useMemo(() => parseProductDescription(value), [value]);
  return <View style={styles.content}>
    {document.text.trim() ? <Text style={styles.text}>{document.text}</Text>
      : !document.tables.length ? <Text style={styles.text}>{fallback}</Text> : null}
    {document.tables.map((table, tableIndex) => <ScrollView key={tableIndex} horizontal nestedScrollEnabled showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
      <View style={styles.table} accessibilityLabel={`Bảng thông tin sản phẩm ${tableIndex + 1}`}>
        {table.rows.map((row, rowIndex) => <View key={rowIndex} style={[styles.row, rowIndex % 2 === 1 && styles.alternateRow, table.header && rowIndex === 0 && styles.headerRow]}>
          {row.map((cell, columnIndex) => <View key={columnIndex} style={[styles.cell, columnIndex === row.length - 1 && styles.lastCell]}>
            <Text style={[styles.cellText, table.header && rowIndex === 0 && styles.headerText]}>{cell || " "}</Text>
          </View>)}
        </View>)}
      </View>
    </ScrollView>)}
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 12 },
  text: { color: "#667085", fontSize: 14, lineHeight: 22, textAlign: "left" },
  tableScroll: { paddingBottom: 6 },
  table: { borderWidth: 1, borderColor: "#dfe5e2", borderRadius: 8, overflow: "hidden" },
  row: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dfe5e2" },
  alternateRow: { backgroundColor: "#f8faf9" },
  headerRow: { backgroundColor: "#eef7f1" },
  cell: { width: 160, paddingHorizontal: 12, paddingVertical: 11, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#dfe5e2" },
  lastCell: { borderRightWidth: 0 },
  cellText: { color: "#344054", fontSize: 13, lineHeight: 20 },
  headerText: { color: "#12613a", fontWeight: "700" },
});
