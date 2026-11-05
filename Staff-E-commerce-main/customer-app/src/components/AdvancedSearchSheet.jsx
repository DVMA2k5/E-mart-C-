import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { IconCheck, IconChevronDown, IconClose, IconFilter } from "./Icons";
import PriceRangeSlider from "./PriceRangeSlider";
import {
  DEFAULT_FILTERS,
  PRICE_PRESETS,
  PROMOTION_OPTIONS,
  activePricePresetOf,
  filterSearchIndex,
  formatPriceInput,
  formatShortMoney,
  parsePriceInput,
  priceFilterError,
  priceSliderBounds,
  sliderToRange,
  toggleCategory,
} from "../utils/productFilters";

const GREEN = "#008848";
const GREEN_SOFT = "#e7f5ee";
const RED = "#d32f2f";
const TEXT_DARK = "#1a202c";
const TEXT_MUTED = "#64748b";
const BORDER = "#e2e8f0";
const NAV_BG = "#f4f6f8";
const COLLAPSED_CHIPS = 6;

const SECTIONS = [
  { key: "category", label: "Danh mục" },
  { key: "price", label: "Giá" },
  { key: "promotion", label: "Khuyến mãi" },
  { key: "status", label: "Tình trạng" },
];

const toDraft = (criteria) => {
  const c = { ...DEFAULT_FILTERS, ...criteria };
  return {
    ...c,
    categoryIds: (c.categoryIds || []).map(String),
    minText: formatPriceInput(c.priceMin),
    maxText: formatPriceInput(c.priceMax),
  };
};

const fromDraft = (draft) => ({
  categoryIds: draft.categoryIds,
  priceMin: parsePriceInput(draft.minText),
  priceMax: parsePriceInput(draft.maxText),
  promotion: draft.promotion,
  inStockOnly: draft.inStockOnly,
  bestSellerOnly: draft.bestSellerOnly,
});

function Chip({ label, selected, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text>
      {selected && (
        <View style={styles.chipTick}>
          <IconCheck size={9} color="#ffffff" />
        </View>
      )}
    </Pressable>
  );
}

function ShowMore({ expanded, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.showMore} accessibilityRole="button">
      <Text style={styles.showMoreText}>{expanded ? "Thu gọn" : "Xem thêm"}</Text>
      <View style={expanded && styles.chevronUp}><IconChevronDown size={14} color={TEXT_MUTED} /></View>
    </Pressable>
  );
}

function PriceInput({ value, onChangeText, placeholder, label, invalid }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#a0aec0"
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={13}
      accessibilityLabel={label}
      style={[styles.priceInput, invalid && styles.priceInputError]}
    />
  );
}

/**
 * "Tùy chọn tìm kiếm" bottom sheet. Edits a draft copy of the filters; nothing changes on the home list
 * until the customer presses "Tìm kiếm". The button shows how many products the draft would return.
 */
export default function AdvancedSearchSheet({ visible, onClose, onApply, criteria, categories, searchIndex, keyword }) {
  const { height, width } = useWindowDimensions();
  const [draft, setDraft] = useState(() => toDraft(criteria));
  const [activeSection, setActiveSection] = useState("category");
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const jumpingTo = useRef(null);

  // Start from the filters currently applied every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setDraft(toDraft(criteria));
    setActiveSection("category");
    sectionY.current = {};
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const applied = useMemo(() => fromDraft(draft), [draft]);
  const priceError = priceFilterError(applied);
  const resultCount = useMemo(
    () => priceError ? 0 : filterSearchIndex(searchIndex, keyword, applied).length,
    [searchIndex, keyword, applied, priceError]
  );
  const activePreset = activePricePresetOf(applied);
  // Slider ends follow the real catalogue (cheapest .. dearest product).
  const sliderBounds = useMemo(() => priceSliderBounds(searchIndex.map(({ product }) => product)), [searchIndex]);
  const onSliderChange = (low, high) => {
    const range = sliderToRange(low, high, sliderBounds);
    update({ minText: formatPriceInput(range.priceMin), maxText: formatPriceInput(range.priceMax) });
  };

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const jumpTo = (key) => {
    setActiveSection(key);
    jumpingTo.current = key;
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 4), animated: true });
    setTimeout(() => { if (jumpingTo.current === key) jumpingTo.current = null; }, 450);
  };

  const onScroll = (event) => {
    if (jumpingTo.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const y = contentOffset.y;
    let current = SECTIONS[0].key;
    if (y + layoutMeasurement.height >= contentSize.height - 4) current = SECTIONS[SECTIONS.length - 1].key;
    else for (const section of SECTIONS) if ((sectionY.current[section.key] ?? Infinity) <= y + 24) current = section.key;
    if (current !== activeSection) setActiveSection(current);
  };

  const sectionLayout = (key) => (event) => { sectionY.current[key] = event.nativeEvent.layout.y; };

  // Accepts "50000", "50.000" or "50k"; shown back grouped as "50.000".
  const setPriceText = (field) => (text) => {
    const value = parsePriceInput(text);
    update({ [field]: value == null ? "" : formatPriceInput(value) });
  };

  const choosePreset = (preset) => {
    if (activePreset?.id === preset.id) update({ minText: "", maxText: "" });
    else update({ minText: formatPriceInput(preset.min), maxText: formatPriceInput(preset.max) });
  };

  const reset = () => {
    setDraft(toDraft({ ...DEFAULT_FILTERS }));
    setCategoriesExpanded(false);
  };

  const submit = () => {
    if (priceError) return;
    onApply(applied);
  };

  const categoryChips = [{ id: "all", name: "Tất cả" }, ...categories];
  // Keep selected chips visible even while the list is collapsed.
  const visibleCategories = categoriesExpanded || categoryChips.length <= COLLAPSED_CHIPS
    ? categoryChips
    : categoryChips.filter((item, index) => index < COLLAPSED_CHIPS || draft.categoryIds.includes(String(item.id)));

  const categoryHint = !draft.categoryIds.length
    ? "Chọn một hoặc nhiều danh mục."
    : draft.categoryIds.length > 1
      ? `Hiện sản phẩm thuộc một trong ${draft.categoryIds.length} danh mục đã chọn.`
      : "Chọn thêm để xem nhiều danh mục cùng lúc.";

  const sheetWidth = Math.min(width, 720);
  const navWidth = width < 360 ? 84 : 104;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng tùy chọn tìm kiếm" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheet, { height: Math.round(height * 0.9), width: sheetWidth }]}
        >
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <Text style={styles.title} accessibilityRole="header">Tùy chọn tìm kiếm</Text>
            <Pressable onPress={onClose} style={styles.headerSide} accessibilityRole="button" accessibilityLabel="Đóng">
              <IconClose size={22} color={TEXT_DARK} />
            </Pressable>
          </View>
          <Text style={styles.keywordHint} numberOfLines={1}>
            {keyword?.trim() ? `Lọc kết quả cho “${keyword.trim()}” · ` : ""}Sản phẩm phải thỏa tất cả các nhóm đã chọn
          </Text>

          <View style={styles.body}>
            <View style={[styles.nav, { width: navWidth }]}>
              {SECTIONS.map((section) => {
                const active = activeSection === section.key;
                return (
                  <Pressable
                    key={section.key}
                    onPress={() => jumpTo(section.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.navItem, active && styles.navItemActive]}
                  >
                    {active && <View style={styles.navIndicator} />}
                    <Text style={[styles.navText, active && styles.navTextActive]}>{section.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              onScroll={onScroll}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="handled"
            >
              <View onLayout={sectionLayout("category")} style={styles.section}>
                <Text style={styles.sectionTitle}>Danh mục</Text>
                <Text style={styles.sectionHint}>{categoryHint}</Text>
                <View style={styles.chipWrap}>
                  {visibleCategories.map((category) => {
                    const all = category.id === "all";
                    return (
                      <Chip
                        key={category.id}
                        label={category.name}
                        selected={all ? draft.categoryIds.length === 0 : draft.categoryIds.includes(String(category.id))}
                        onPress={() => update({ categoryIds: all ? [] : toggleCategory(draft.categoryIds, category.id) })}
                        accessibilityLabel={all ? "Tất cả danh mục" : `Chọn danh mục ${category.name}`}
                      />
                    );
                  })}
                </View>
                {categoryChips.length > COLLAPSED_CHIPS && (
                  <ShowMore expanded={categoriesExpanded} onPress={() => setCategoriesExpanded((value) => !value)} />
                )}
              </View>

              <View onLayout={sectionLayout("price")} style={styles.section}>
                <Text style={styles.sectionTitle}>Khoảng giá (đ)</Text>
                {sliderBounds && (
                  <>
                    <View style={styles.sliderCaption}>
                      <IconFilter size={14} color={GREEN} />
                      <Text style={styles.sliderCaptionText}>Kéo để chọn mức giá phù hợp với bạn</Text>
                    </View>
                    <PriceRangeSlider
                      bounds={sliderBounds}
                      low={applied.priceMin}
                      high={applied.priceMax}
                      onChange={onSliderChange}
                      formatLabel={formatShortMoney}
                    />
                  </>
                )}
                <View style={[styles.priceRow, styles.priceRowSpaced]}>
                  <PriceInput value={draft.minText} onChangeText={setPriceText("minText")} placeholder="TỐI THIỂU" label="Giá tối thiểu" invalid={!!priceError} />
                  <View style={styles.priceDash} />
                  <PriceInput value={draft.maxText} onChangeText={setPriceText("maxText")} placeholder="TỐI ĐA" label="Giá tối đa" invalid={!!priceError} />
                </View>
                {!!priceError && <Text style={styles.errorText}>{priceError}</Text>}
                <View style={[styles.chipWrap, styles.presetWrap]}>
                  {PRICE_PRESETS.map((preset) => (
                    <Chip
                      key={preset.id}
                      label={preset.label}
                      selected={activePreset?.id === preset.id}
                      onPress={() => choosePreset(preset)}
                      accessibilityLabel={`Khoảng giá ${preset.label}`}
                    />
                  ))}
                </View>
              </View>

              <View onLayout={sectionLayout("promotion")} style={styles.section}>
                <Text style={styles.sectionTitle}>Khuyến mãi</Text>
                <View style={styles.chipWrap}>
                  {PROMOTION_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      selected={draft.promotion === option.id}
                      onPress={() => update({ promotion: draft.promotion === option.id ? "all" : option.id })}
                    />
                  ))}
                </View>
              </View>

              <View onLayout={sectionLayout("status")} style={styles.section}>
                <Text style={styles.sectionTitle}>Tình trạng</Text>
                <View style={styles.chipWrap}>
                  <Chip label="Còn hàng" selected={draft.inStockOnly} onPress={() => update({ inStockOnly: !draft.inStockOnly })} />
                  <Chip label="Bán chạy" selected={draft.bestSellerOnly} onPress={() => update({ bestSellerOnly: !draft.bestSellerOnly })} />
                </View>
              </View>
            </ScrollView>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.resultHint, !priceError && resultCount === 0 && styles.resultHintEmpty]} accessibilityLiveRegion="polite">
              {priceError
                ? "Hãy sửa điều kiện giá để tìm kiếm."
                : resultCount === 0
                  ? "Không có sản phẩm phù hợp — thử bỏ bớt điều kiện."
                  : `Tìm thấy ${resultCount} sản phẩm phù hợp`}
            </Text>
            <View style={styles.footerButtons}>
              <Pressable onPress={reset} style={[styles.footerButton, styles.resetButton]} accessibilityRole="button">
                <Text style={styles.resetText}>Thiết lập lại</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!!priceError}
                style={[styles.footerButton, styles.applyButton, !!priceError && styles.applyDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Tìm kiếm, ${resultCount} sản phẩm`}
              >
                <Text style={styles.applyText}>Tìm kiếm{priceError ? "" : ` (${resultCount})`}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", height: 56, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8 },
  headerSide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: TEXT_DARK },
  keywordHint: { fontSize: 11, color: TEXT_MUTED, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#fafafa" },
  body: { flex: 1, flexDirection: "row" },
  nav: { backgroundColor: NAV_BG },
  navItem: { minHeight: 56, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10 },
  navItemActive: { backgroundColor: "#ffffff" },
  navIndicator: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: GREEN },
  navText: { fontSize: 13, color: TEXT_MUTED, lineHeight: 18 },
  navTextActive: { color: GREEN, fontWeight: "700" },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { paddingTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: TEXT_DARK, marginBottom: 10 },
  sectionHint: { fontSize: 11, color: TEXT_MUTED, marginTop: 8, marginBottom: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetWrap: { marginTop: 10 },
  chip: { minHeight: 40, maxWidth: "100%", justifyContent: "center", paddingHorizontal: 14, borderRadius: 6, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#f3f4f6", overflow: "hidden" },
  chipSelected: { backgroundColor: GREEN_SOFT, borderColor: GREEN },
  chipPressed: { opacity: 0.75 },
  chipText: { fontSize: 13, color: TEXT_DARK },
  chipTextSelected: { color: GREEN, fontWeight: "700" },
  chipTick: { position: "absolute", right: 0, bottom: 0, width: 16, height: 14, borderTopLeftRadius: 6, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  showMore: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 10 },
  showMoreText: { fontSize: 13, color: TEXT_MUTED },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  priceRow: { flexDirection: "row", alignItems: "center" },
  priceRowSpaced: { marginTop: 12 },
  sliderCaption: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  sliderCaptionText: { fontSize: 12, color: GREEN, fontWeight: "600" },
  priceInput: { flex: 1, minWidth: 0, height: 42, borderWidth: 1, borderColor: BORDER, borderRadius: 6, textAlign: "center", fontSize: 13, color: TEXT_DARK, paddingHorizontal: 6, outlineStyle: "none" },
  priceInputError: { borderColor: RED },
  priceDash: { width: 12, height: 1, backgroundColor: "#cbd5e1", marginHorizontal: 8 },
  errorText: { fontSize: 12, color: RED, marginTop: 6 },
  footer: { borderTopWidth: 1, borderTopColor: BORDER, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Platform.OS === "ios" ? 24 : 14 },
  resultHint: { fontSize: 12, color: TEXT_MUTED, textAlign: "center", marginBottom: 8 },
  resultHintEmpty: { color: RED },
  footerButtons: { flexDirection: "row", gap: 12 },
  footerButton: { flex: 1, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resetButton: { borderWidth: 1, borderColor: GREEN, backgroundColor: "#ffffff" },
  resetText: { color: GREEN, fontSize: 15, fontWeight: "700" },
  applyButton: { backgroundColor: GREEN },
  applyDisabled: { backgroundColor: "#a0aec0" },
  applyText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
