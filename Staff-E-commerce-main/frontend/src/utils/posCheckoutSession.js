// Keep the exact submitted request until the server gives a definite outcome.
// sessionStorage survives reload in this tab; each employee has a separate key.
export const pendingCheckoutKey = (userId) => `pos.pending-checkout.v1.${userId || "unknown"}`;
export function readPendingCheckout(storage, key) {
  const value = storage.getItem(key);
  if (!value) return null;
  const pending = JSON.parse(value);
  if (typeof pending?.payload?.requestId !== "string" || !Array.isArray(pending.payload.items) || !pending.payload.items.length)
    throw new Error("Yêu cầu POS đang lưu không hợp lệ. Cần kiểm tra lịch sử đơn hàng trước khi xóa dữ liệu phiên.");
  return pending;
}
export function savePendingCheckout(storage, key, payload) {
  const pending = { payload, createdAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(pending));
  return pending;
}
// Authorization or routing can change after a lost response; they do not prove
// that the original transaction failed. Retain the key in those cases.
export const isDefiniteCheckoutFailure = (error) => [400, 409, 422].includes(error?.status);
