import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { sliderPositionOf, sliderValueAt } from "../utils/productFilters";

const THUMB = 26;
const GREEN = "#008848";
const TRACK = "#e2e8f0";
const TEXT_MUTED = "#64748b";
const A11Y_STEP = 0.02; // one screen-reader increment = 2% of the track

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Two-thumb price slider built on PanResponder (works on Android, iOS and web without extra packages).
 * `bounds` comes from priceSliderBounds(); `low` / `high` are the current bounds (null = open end);
 * `onChange(low, high)` fires while dragging.
 */
export default function PriceRangeSlider({ bounds, low, high, onChange, formatLabel }) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(null);
  const lowValue = clamp(low ?? bounds.min, bounds.min, bounds.max);
  const highValue = clamp(high ?? bounds.max, bounds.min, bounds.max);
  const usable = Math.max(1, width - THUMB);

  // PanResponders are created once, so they read the latest props through this ref.
  const latest = useRef({});
  latest.current = { bounds, lowValue, highValue, usable, onChange };
  const dragStart = useRef(0);

  const pixelOf = (value) => sliderPositionOf(value, latest.current.bounds) * latest.current.usable;
  const valueAtPixel = (x) => sliderValueAt(x / latest.current.usable, latest.current.bounds);

  const move = (which, value) => {
    const s = latest.current;
    if (which === "low") s.onChange(Math.min(value, s.highValue), s.highValue);
    else s.onChange(s.lowValue, Math.max(value, s.lowValue));
  };

  const makeResponder = (which) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Keep the drag even when the finger drifts vertically over the scrolling sheet.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const s = latest.current;
      dragStart.current = pixelOf(which === "low" ? s.lowValue : s.highValue);
      setDragging(which);
    },
    onPanResponderMove: (_, gesture) => move(which, valueAtPixel(dragStart.current + gesture.dx)),
    onPanResponderRelease: () => setDragging(null),
    onPanResponderTerminate: () => setDragging(null),
  });

  const lowResponder = useRef(makeResponder("low")).current;
  const highResponder = useRef(makeResponder("high")).current;

  const lowX = pixelOf(lowValue);
  const highX = pixelOf(highValue);
  // When both thumbs meet at the right end, the low one must be on top so it can still move left.
  const lowOnTop = lowX > usable / 2;

  const thumbA11y = (which) => {
    const value = which === "low" ? lowValue : highValue;
    return {
      accessible: true,
      accessibilityRole: "adjustable",
      accessibilityLabel: which === "low" ? "Giá thấp nhất" : "Giá cao nhất",
      accessibilityValue: { min: bounds.min, max: bounds.max, now: value, text: formatLabel(value) },
      accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
      onAccessibilityAction: (event) => {
        const delta = event.nativeEvent.actionName === "increment" ? A11Y_STEP : -A11Y_STEP;
        move(which, sliderValueAt(sliderPositionOf(value, bounds) + delta, bounds));
      },
    };
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.area} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.track} />
        {width > 0 && (
          <>
            <View style={[styles.activeTrack, { left: lowX + THUMB / 2, width: Math.max(0, highX - lowX) }]} />
            <View
              {...lowResponder.panHandlers}
              {...thumbA11y("low")}
              style={[styles.thumb, { left: lowX, zIndex: lowOnTop ? 3 : 2 }, dragging === "low" && styles.thumbActive]}
            />
            <View
              {...highResponder.panHandlers}
              {...thumbA11y("high")}
              style={[styles.thumb, { left: highX, zIndex: lowOnTop ? 2 : 3 }, dragging === "high" && styles.thumbActive]}
            />
          </>
        )}
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{formatLabel(bounds.min)}</Text>
        <Text style={styles.label}>{formatLabel(bounds.max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14 },
  area: { height: THUMB + 8, justifyContent: "center", userSelect: "none" },
  track: { position: "absolute", left: THUMB / 2, right: THUMB / 2, height: 5, borderRadius: 3, backgroundColor: TRACK },
  activeTrack: { position: "absolute", height: 5, borderRadius: 3, backgroundColor: GREEN },
  thumb: {
    position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: GREEN,
    borderWidth: 3, borderColor: "#ffffff", cursor: "grab", touchAction: "none",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  thumbActive: { transform: [{ scale: 1.15 }], cursor: "grabbing" },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  label: { fontSize: 11, color: TEXT_MUTED },
});
