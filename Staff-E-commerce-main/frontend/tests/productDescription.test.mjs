import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizePastedDescription } from "../src/utils/productDescriptionClipboard.js";

test("Word paste removes indentation, invisible spaces and repeated empty lines", () => {
  const cleaned = normalizePastedDescription({ text: "\r\n\t Thông\u00a0\u00a0tin   sản phẩm \r\n \r\n\r\n\r\n  Dòng tiếp theo\u200b  \n", tables: [] });
  assert.equal(cleaned.text, "Thông tin sản phẩm\n\nDòng tiếp theo");
});

test("Word table cells become compact without changing rows or columns", () => {
  const cleaned = normalizePastedDescription({ text: "", tables: [{ header: true, rows: [[" Tên \n\n\n", "Chi tiết"], ["Xuất xứ", "\n Việt Nam\n\n\n Đóng gói trong nước\n"]] }] });
  assert.deepEqual(cleaned.tables, [{ header: true, rows: [["Tên", "Chi tiết"], ["Xuất xứ", "Việt Nam\nĐóng gói trong nước"]] }]);
});

test("Word paste keeps meaningful line breaks and Vietnamese text", () => {
  const description = { text: "Đặc điểm\n• Lông mềm\n• Dễ sử dụng\n\nHướng dẫn sử dụng", tables: [] };
  assert.deepEqual(normalizePastedDescription(description), description);
});

const files = [
  new URL("../src/utils/productDescription.js", import.meta.url),
  new URL("../../customer-app/src/utils/productDescription.js", import.meta.url),
];
const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));

test("admin and app use the same description format", () => assert.equal(sources[0], sources[1]));

for (const [index, source] of sources.entries()) {
  const { parseProductDescription: parse, serializeProductDescription: serialize } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const client = index === 0 ? "admin" : "app";
  test(`${client}: existing descriptions retain text and line breaks`, () => {
    for (const value of ["", "Mô tả sản phẩm\nDòng thứ hai", '{"name":"Thông tin cũ"}', "<script>alert(1)</script>"]) {
      assert.deepEqual(parse(value), { text: value, tables: [] });
      assert.equal(serialize(parse(value)), value);
    }
    assert.deepEqual(parse(null), { text: "", tables: [] });
  });
  test(`${client}: editing and saving multiple tables preserves all cell content`, () => {
    const document = { text: "Bàn chải mềm", tables: [
      { header: true, rows: [["Thông tin", "Chi tiết"], ["Xuất xứ", "Việt Nam\nĐóng gói tại nhà máy"]] },
      { header: false, rows: [["Chất liệu", "Nhựa", "Sợi mềm"]] },
    ] };
    assert.deepEqual(parse(serialize(document)), document);
    assert.deepEqual(parse(serialize({ ...document, tables: [] })), { text: document.text, tables: [] });
  });
  test(`${client}: malformed stored tables cannot crash the renderer`, () => {
    const value = JSON.stringify({ format: "emart-product-description-v1", text: "Mô tả", tables: [null, { rows: [] }, { rows: [null] }, { rows: [["A", "B"], ["C", 42]] }] });
    assert.deepEqual(parse(value), { text: "Mô tả", tables: [{ header: true, rows: [["A", "B"], ["C", ""]] }] });
  });
  test(`${client}: oversized tables are bounded on read`, () => {
    const value = JSON.stringify({ format: "emart-product-description-v1", text: "", tables: [{ rows: Array.from({ length: 100 }, () => Array(20).fill("ô")) }] });
    const table = parse(value).tables[0];
    assert.equal(table.rows.length, 50);
    assert.equal(table.rows[0].length, 8);
  });
}
