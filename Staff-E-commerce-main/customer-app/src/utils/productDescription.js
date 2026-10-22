const FORMAT = "emart-product-description-v1";
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLUMNS = 8;

export function parseProductDescription(value) {
  const raw = typeof value === "string" ? value : "";
  try {
    const document = JSON.parse(raw);
    if (document?.format !== FORMAT || typeof document.text !== "string" || !Array.isArray(document.tables)) {
      return { text: raw, tables: [] };
    }
    const tables = document.tables.filter((table) => Array.isArray(table?.rows) && table.rows.length > 0)
      .map((table) => {
        const source = table.rows.slice(0, MAX_TABLE_ROWS).filter(Array.isArray);
        const columns = Math.min(MAX_TABLE_COLUMNS, Math.max(1, ...source.map((row) => row.length)));
        return {
          header: table.header !== false,
          rows: source.map((row) => Array.from({ length: columns }, (_, index) => typeof row[index] === "string" ? row[index] : "")),
        };
      }).filter((table) => table.rows.length > 0);
    return { text: document.text, tables };
  } catch {
    return { text: raw, tables: [] };
  }
}

export function serializeProductDescription(document) {
  if (!document.tables.length) return document.text;
  return JSON.stringify({ format: FORMAT, text: document.text, tables: document.tables });
}
