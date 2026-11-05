import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FILTERS,
  PRICE_PRESETS,
  activePricePresetOf,
  buildSearchIndex,
  countActiveFilters,
  describeActiveFilters,
  discountPercentOf,
  filterSearchIndex,
  hasPriceFilter,
  matchingPricePreset,
  normalizeSearch,
  parsePriceInput,
  priceFilterError,
  priceRangeError,
  formatShortMoney,
  priceSliderBounds,
  sliderPositionOf,
  sliderStepFor,
  sliderToRange,
  sliderValueAt,
  snapPrice,
  priceRangeLabel,
  productMatches,
  removeFilter,
  singleCategoryId,
  sortProducts,
  toggleCategory,
} from "../src/utils/productFilters.js";

// Shaped exactly like GET /api/storefront/products (StorefrontProductDTO, camelCase JSON).
const products = [
  { id: 1, productName: "Sữa tươi Vinamilk", categoryId: 1, categoryName: "Sữa", price: 18000, originalPrice: 20000, discountAmount: 2000, stockQuantity: 50, soldCount: 30, isBestSeller: true },
  { id: 2, productName: "Bánh quy bơ", categoryId: 2, categoryName: "Bánh kẹo", price: 35000, originalPrice: 50000, discountAmount: 15000, stockQuantity: 0, soldCount: 5, isBestSeller: false },
  { id: 3, productName: "Thịt bò Úc", categoryId: 3, categoryName: "Thịt", price: 120000, originalPrice: 120000, discountAmount: 0, stockQuantity: 8, soldCount: 12, isBestSeller: true },
  { id: 4, productName: "Sữa chua Ba Vì", categoryId: 1, categoryName: "Sữa", price: 20000, originalPrice: 20000, discountAmount: 0, stockQuantity: 3, soldCount: 40, isBestSeller: false },
  { id: 5, productName: "Nước giặt", categoryId: 4, categoryName: "Hóa phẩm", price: 50000, originalPrice: 100000, discountAmount: 50000, stockQuantity: 10, soldCount: 0, isBestSeller: false },
];
const index = buildSearchIndex(products);
const ids = (list) => list.map((product) => product.id);
const run = (criteria, keyword = "") => ids(filterSearchIndex(index, keyword, criteria));

test("no filters returns the whole catalogue in catalogue order", () => {
  assert.deepEqual(run(DEFAULT_FILTERS), [1, 2, 3, 4, 5]);
});

test("keyword search ignores Vietnamese accents and also matches the category name", () => {
  assert.equal(normalizeSearch("Sữa Đậu"), "sua dau");
  assert.deepEqual(run(DEFAULT_FILTERS, "sua"), [1, 4]);
  assert.deepEqual(run(DEFAULT_FILTERS, "hoa pham"), [5]);
});

test("price range is >= min AND <= max, either side optional", () => {
  assert.deepEqual(run({ priceMin: 20000, priceMax: 50000 }), [2, 4, 5]);
  assert.deepEqual(run({ priceMax: 20000 }), [1, 4]);
  assert.deepEqual(run({ priceMin: 100000 }), [3]);
});

test("categories: OR over several selected categories", () => {
  assert.deepEqual(run({ categoryIds: ["1"] }), [1, 4]);
  assert.deepEqual(run({ categoryIds: ["1", "3"] }), [1, 3, 4]);
  // Ids from the API are numbers, the UI keeps strings.
  assert.deepEqual(run({ categoryIds: [2, "4"] }), [2, 5]);
});

test("promotion filters use the same discount the product card badge shows", () => {
  assert.equal(discountPercentOf(products[0]), 10);
  assert.equal(discountPercentOf(products[1]), 30);
  assert.deepEqual(run({ promotion: "sale" }), [1, 2, 5]);
  assert.deepEqual(run({ promotion: "sale20" }), [2, 5]);
});

test("stock and best-seller filters", () => {
  assert.deepEqual(run({ inStockOnly: true }), [1, 3, 4, 5]);
  assert.deepEqual(run({ bestSellerOnly: true }), [1, 3]);
});

test("AND across groups combined with OR inside the category group", () => {
  // (Sữa OR Thịt) AND price >= 19.000 AND in stock
  assert.deepEqual(run({ categoryIds: ["1", "3"], priceMin: 19000, inStockOnly: true }), [3, 4]);
  // (Sữa OR Bánh kẹo) AND on sale AND price <= 30.000
  assert.deepEqual(run({ categoryIds: ["1", "2"], promotion: "sale", priceMax: 30000 }), [1]);
  assert.equal(productMatches(products[3], { categoryIds: ["1"], priceMax: 19000 }), false);
});

test("sorting does not mutate the filtered list and keeps ties stable", () => {
  const list = filterSearchIndex(index, "", DEFAULT_FILTERS);
  assert.deepEqual(ids(sortProducts(list, "price_asc")), [1, 4, 2, 5, 3]);
  assert.deepEqual(ids(sortProducts(list, "price_desc")), [3, 5, 2, 4, 1]);
  assert.deepEqual(ids(sortProducts(list, "hot")), [4, 1, 3, 2, 5]);
  assert.equal(sortProducts(list, "default"), list);
});

test("price input and validation", () => {
  assert.equal(parsePriceInput("50.000"), 50000);
  assert.equal(parsePriceInput("50k"), 50000);
  assert.equal(parsePriceInput(""), null);
  assert.equal(parsePriceInput("abc"), null);
  assert.match(priceRangeError(60000, 50000), /nhỏ hơn/);
  assert.match(priceFilterError({ priceMin: 60000, priceMax: 50000 }), /nhỏ hơn/);
  assert.equal(priceFilterError({ priceMin: 50000, priceMax: 50000 }), "");
});

test("home price chips and the sheet presets recognise the same range", () => {
  for (const preset of PRICE_PRESETS) assert.equal(matchingPricePreset(preset.min, preset.max)?.id, preset.id);
  assert.equal(activePricePresetOf({ priceMin: null, priceMax: 20000 })?.id, "lt20");
  assert.equal(activePricePresetOf({ priceMin: 30000, priceMax: 80000 }), null);
  assert.equal(hasPriceFilter({ priceMin: 1 }), true);
  assert.equal(hasPriceFilter(DEFAULT_FILTERS), false);
  assert.equal(priceRangeLabel(30000, 80000), "30k – 80k");
});

test("price slider ends cover the cheapest and dearest product in whole steps", () => {
  assert.deepEqual(priceSliderBounds(products), { min: 18000, max: 120000, step: 1000, curve: 1 });
  assert.deepEqual(priceSliderBounds([{ price: 12345 }, { price: 1_234_567 }]), { min: 10000, max: 1_235_000, step: 5000, curve: 2.5 });
  assert.equal(sliderStepFor(5_000_000), 10000);
  // Nothing to slide between.
  assert.equal(priceSliderBounds([]), null);
  assert.equal(priceSliderBounds([{ price: 20000 }, { price: 20000 }]), null);
});

test("wide price ranges use a curve that gives cheap prices a usable part of the track", () => {
  const bounds = priceSliderBounds([{ price: 5000 }, { price: 1_500_000 }]);
  assert.equal(bounds.curve, 2.5);
  // 100k sits about a third of the way along instead of ~6% on a linear track.
  assert.ok(sliderPositionOf(100_000, bounds) > 0.3);
  assert.equal(sliderValueAt(0, bounds), bounds.min);
  assert.equal(sliderValueAt(1, bounds), bounds.max);
  // Position -> value -> position is stable after snapping, and values grow with the position.
  let previous = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const value = sliderValueAt(t, bounds);
    assert.ok(value >= previous, `not monotonic at ${t}`);
    assert.equal(sliderValueAt(sliderPositionOf(value, bounds), bounds), value);
    previous = value;
  }
  assert.equal(snapPrice(23_456), 23_000);
  assert.equal(snapPrice(381_000), 380_000);
  assert.equal(snapPrice(1_234_000), 1_230_000);
  assert.equal(formatShortMoney(1_500_000), "1,5tr");
  assert.equal(formatShortMoney(25_000), "25k");
});

test("slider thumbs resting on an end mean 'no bound', so the full range filters nothing", () => {
  const bounds = { min: 18000, max: 120000, step: 1000 };
  assert.deepEqual(sliderToRange(18000, 120000, bounds), { priceMin: null, priceMax: null });
  assert.deepEqual(sliderToRange(30000, 120000, bounds), { priceMin: 30000, priceMax: null });
  assert.deepEqual(sliderToRange(18000, 50000, bounds), { priceMin: null, priceMax: 50000 });
  assert.deepEqual(run(sliderToRange(30000, 60000, bounds)), [2, 5]);
  assert.deepEqual(run(sliderToRange(bounds.min, bounds.max, bounds)), [1, 2, 3, 4, 5]);
});

test("quick category tags only show a single included category as selected", () => {
  assert.equal(singleCategoryId(DEFAULT_FILTERS), "all");
  assert.equal(singleCategoryId({ categoryIds: [3] }), "3");
  assert.equal(singleCategoryId({ categoryIds: ["1", "3"] }), null);
  assert.deepEqual(toggleCategory(["1"], 3), ["1", "3"]);
  assert.deepEqual(toggleCategory(["1", "3"], "1"), ["3"]);
});

test("active filter chips describe OR and price ranges and can be removed one by one", () => {
  const categories = [{ id: 1, name: "Sữa" }, { id: 3, name: "Thịt" }];
  assert.deepEqual(describeActiveFilters({ categoryIds: ["1", "3"] }, categories).map((c) => c.label), ["Sữa hoặc Thịt"]);
  assert.deepEqual(describeActiveFilters({ priceMin: 15500 }).map((c) => c.label), ["Từ 15.500đ"]);

  const criteria = { categoryIds: ["1", "3"], priceMin: 20000, priceMax: 50000, promotion: "sale20", inStockOnly: true, bestSellerOnly: true };
  const chips = describeActiveFilters(criteria, categories);
  assert.equal(chips.length, 5);
  assert.equal(countActiveFilters(DEFAULT_FILTERS), 0);
  let next = criteria;
  for (const chip of chips) next = removeFilter(next, chip.key);
  assert.deepEqual(next, { ...DEFAULT_FILTERS, categoryIds: [] });
});

test("every product field the filters read is returned by the backend StorefrontProductDTO", () => {
  const dtoPath = fileURLToPath(new URL("../../backend/DTO/StorefrontProductDTO.cs", import.meta.url));
  const source = readFileSync(dtoPath, "utf8");
  const dto = source.slice(source.indexOf("class StorefrontProductDTO"), source.indexOf("class StorefrontProductPageDTO"));
  const properties = new Set([...dto.matchAll(/public\s+[\w?<>]+\s+(\w+)\s*\{\s*get;/g)]
    .map(([, name]) => name[0].toLowerCase() + name.slice(1)));
  for (const field of ["id", "productName", "categoryId", "categoryName", "price", "originalPrice", "discountAmount", "stockQuantity", "soldCount", "isBestSeller"]) {
    assert.ok(properties.has(field), `StorefrontProductDTO is missing ${field}`);
  }
});
