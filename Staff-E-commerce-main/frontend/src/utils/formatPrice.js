export const formatPrice = (v) => {
  if (v == null) return "—";
  try {
    return Intl.NumberFormat("vi-VN").format(Number(v)) + " ₫";
  } catch {
    return v;
  }
};
