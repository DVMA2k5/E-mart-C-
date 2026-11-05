// Pure product search/filter/sort rules shared by the home list and the advanced search sheet.
// Every criterion maps to a field the storefront API already returns (StorefrontProductDTO):
// categoryId, price, originalPrice/discountAmount, stockQuantity, isBestSeller, soldCount.
//
// Logic used:
//   - AND : every group (category, price, promotion, status) must hold at the same time.
//   - OR  : several selected categories -> the product belongs to ANY of them.
//   - >= / <= : the price range (either side optional).

// Lowercase and strip Vietnamese accents so "sua" finds "Sữa" and "banh" finds "Bánh".
export const normalizeSearch = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D")
  .toLowerCase()
  .trim();

export const buildSearchIndex = (products) => (Array.isArray(products) ? products : [])
  .map((product) => ({ product, text: normalizeSearch(`${product.productName} ${product.categoryName || ""}`) }));

// Range bounds are inclusive on both ends (a 20.000đ product matches "Dưới 20k" and "20k – 50k").
export const PRICE_PRESETS = [
  { id: "lt20", label: "Dưới 20k", min: null, max: 20000 },
  { id: "20to50", label: "20k – 50k", min: 20000, max: 50000 },
  { id: "50to100", label: "50k – 100k", min: 50000, max: 100000 },
  { id: "gt100", label: "Trên 100k", min: 100000, max: null },
];

export const PROMOTION_OPTIONS = [
  { id: "sale", label: "Đang giảm giá", minPercent: 0 },
  { id: "sale20", label: "Giảm từ 20%", minPercent: 20 },
  { id: "sale30", label: "Giảm từ 30%", minPercent: 30 },
];

export const DEFAULT_FILTERS = Object.freeze({
  categoryIds: Object.freeze([]),
  priceMin: null,
  priceMax: null,
  promotion: "all",
  inStockOnly: false,
  bestSellerOnly: false,
});

const withDefaults = (criteria) => {
  const c = { ...DEFAULT_FILTERS, ...criteria };
  return { ...c, categoryIds: (c.categoryIds || []).map(String) };
};

const stockOf = (product) => Number.isFinite(product?.stockQuantity) ? Math.max(0, Math.floor(product.stockQuantity)) : 0;

// Same definitions the product card and flash sale use, so a "giảm 20%" badge and the filter always agree.
export const discountAmountOf = (product) =>
  Math.max(0, product.discountAmount ?? ((product.originalPrice ?? product.price) - product.price));

export const discountPercentOf = (product) => {
  const original = product.originalPrice ?? product.price;
  return original > 0 ? Math.max(0, Math.round(((original - product.price) / original) * 100)) : 0;
};

function matchesCategory(product, c) {
  if (!c.categoryIds.length) return true;
  const productCategory = String(product.categoryId);
  return c.categoryIds.some((id) => productCategory === id); // OR
}

function matchesPrice(product, c) {
  const price = Number(product.price) || 0;
  return (c.priceMin == null || price >= c.priceMin) && (c.priceMax == null || price <= c.priceMax);
}

function matchesPromotion(product, c) {
  if (c.promotion === "all") return true;
  const option = PROMOTION_OPTIONS.find((item) => item.id === c.promotion);
  if (!option) return true;
  return discountAmountOf(product) > 0 && discountPercentOf(product) >= option.minPercent;
}

// AND across all groups.
export function productMatches(product, criteria = DEFAULT_FILTERS) {
  const c = withDefaults(criteria);
  return matchesCategory(product, c)
    && matchesPrice(product, c)
    && matchesPromotion(product, c)
    && (!c.inStockOnly || stockOf(product) > 0)
    && (!c.bestSellerOnly || !!product.isBestSeller);
}

export function filterSearchIndex(index, keyword, criteria) {
  const term = normalizeSearch(keyword);
  return index
    .filter(({ product, text }) => (!term || text.includes(term)) && productMatches(product, criteria))
    .map(({ product }) => product);
}

export function sortProducts(products, sortOption) {
  if (sortOption === "price_asc") return [...products].sort((a, b) => a.price - b.price);
  if (sortOption === "price_desc") return [...products].sort((a, b) => b.price - a.price);
  // Real sales from the last 30 days; ties keep the catalogue order (Array#sort is stable).
  if (sortOption === "hot") return [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
  return products;
}

// "50.000" / "50000" / "50k" -> 50000; empty or invalid -> null.
export function parsePriceInput(text) {
  const raw = String(text ?? "").trim().toLowerCase();
  if (!raw) return null;
  const thousands = /k$/.test(raw);
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits) * (thousands ? 1000 : 1);
  return Number.isFinite(value) ? value : null;
}

export const formatPriceInput = (value) =>
  value == null || value === "" ? "" : new Intl.NumberFormat("vi-VN").format(Number(value));

export function priceRangeError(min, max) {
  if (min != null && max != null && min > max) return "Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.";
  return "";
}

export function priceFilterError(criteria) {
  const c = withDefaults(criteria);
  return priceRangeError(c.priceMin, c.priceMax);
}

export const hasPriceFilter = (criteria) => {
  const c = withDefaults(criteria);
  return c.priceMin != null || c.priceMax != null;
};

export const matchingPricePreset = (min, max) =>
  PRICE_PRESETS.find((preset) => preset.min === (min ?? null) && preset.max === (max ?? null)) || null;

// The preset chip that is lit for the current filters.
export const activePricePresetOf = (criteria) => {
  const c = withDefaults(criteria);
  return matchingPricePreset(c.priceMin, c.priceMax);
};

const groupVi = (value) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const shortMoney = (value) => {
  if (value >= 1_000_000 && value % 10_000 === 0) return `${groupVi(value / 1_000_000)}tr`;
  if (value >= 1000 && value % 1000 === 0) return `${groupVi(value / 1000)}k`;
  return `${groupVi(value)}đ`;
};
export const formatShortMoney = shortMoney;

// Round a dragged price to a step that suits its size: 1.000đ under 100k, 5.000đ under 1tr, then 10.000đ.
export function snapPrice(value) {
  const step = value < 100_000 ? 1000 : value < 1_000_000 ? 5000 : 10_000;
  return Math.round(value / step) * step;
}

// Slider step that keeps the thumbs precise without hundreds of tiny jumps.
export const sliderStepFor = (range) => range <= 200000 ? 1000 : range <= 2000000 ? 5000 : 10000;

// Price slider ends: the cheapest / dearest product in the catalogue, widened to whole steps so the
// end positions always include them. null when there is nothing to slide between.
export function priceSliderBounds(products) {
  const prices = (products || []).map((product) => Number(product.price)).filter(Number.isFinite);
  if (!prices.length) return null;
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const step = sliderStepFor(highest - lowest);
  const min = Math.floor(lowest / step) * step;
  const max = Math.ceil(highest / step) * step;
  if (max <= min) return null;
  // Grocery prices are skewed (most items are cheap): a wide range gets a power curve so the cheap end
  // takes a usable share of the track instead of a few pixels.
  const curve = max / Math.max(min, 1000) > 20 ? 2.5 : 1;
  return { min, max, step, curve };
}

// Track position (0..1) <-> price, following the bounds' curve. Values are snapped and kept in bounds.
export function sliderValueAt(position, bounds) {
  const t = Math.min(1, Math.max(0, position));
  if (t <= 0) return bounds.min;
  if (t >= 1) return bounds.max;
  const raw = bounds.min + (bounds.max - bounds.min) * Math.pow(t, bounds.curve || 1);
  return Math.min(bounds.max, Math.max(bounds.min, snapPrice(raw)));
}

export function sliderPositionOf(value, bounds) {
  const ratio = (Math.min(bounds.max, Math.max(bounds.min, value)) - bounds.min) / (bounds.max - bounds.min);
  return Math.pow(ratio, 1 / (bounds.curve || 1));
}

// Thumb value -> filter bound: a thumb resting on its end means "no bound" (null), like an empty input.
export function sliderToRange(low, high, bounds) {
  return {
    priceMin: low <= bounds.min ? null : low,
    priceMax: high >= bounds.max ? null : high,
  };
}

export function priceRangeLabel(min, max) {
  if (min == null && max == null) return "";
  const preset = matchingPricePreset(min, max);
  if (preset) return preset.label;
  if (min == null) return `Đến ${shortMoney(max)}`;
  if (max == null) return `Từ ${shortMoney(min)}`;
  return `${shortMoney(min)} – ${shortMoney(max)}`;
}

// The single category the home quick tags can show as selected: "all", one id, or null (several).
export function singleCategoryId(criteria) {
  const c = withDefaults(criteria);
  if (!c.categoryIds.length) return "all";
  return c.categoryIds.length === 1 ? c.categoryIds[0] : null;
}

export const toggleCategory = (ids, id) => {
  const key = String(id);
  return ids.map(String).includes(key) ? ids.filter((item) => String(item) !== key) : [...ids, key];
};

// Chips shown under the toolbar; each one can be removed on its own with removeFilter().
export function describeActiveFilters(criteria, categories = []) {
  const c = withDefaults(criteria);
  const chips = [];
  if (c.categoryIds.length) {
    const names = c.categoryIds.map((id) => categories.find((item) => String(item.id) === id)?.name || "Danh mục");
    chips.push({ key: "category", label: names.join(" hoặc ") });
  }
  if (hasPriceFilter(c)) chips.push({ key: "price", label: priceRangeLabel(c.priceMin, c.priceMax) });
  if (c.promotion !== "all") {
    const option = PROMOTION_OPTIONS.find((item) => item.id === c.promotion);
    if (option) chips.push({ key: "promotion", label: option.label });
  }
  if (c.inStockOnly) chips.push({ key: "inStock", label: "Còn hàng" });
  if (c.bestSellerOnly) chips.push({ key: "bestSeller", label: "Bán chạy" });
  return chips;
}

export const countActiveFilters = (criteria, categories) => describeActiveFilters(criteria, categories).length;

export function removeFilter(criteria, key) {
  const c = withDefaults(criteria);
  if (key === "category") return { ...c, categoryIds: [] };
  if (key === "price") return { ...c, priceMin: null, priceMax: null };
  if (key === "promotion") return { ...c, promotion: "all" };
  if (key === "inStock") return { ...c, inStockOnly: false };
  if (key === "bestSeller") return { ...c, bestSellerOnly: false };
  return c;
}
