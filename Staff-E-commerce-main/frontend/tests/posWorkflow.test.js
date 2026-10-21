import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingCheckoutKey, readPendingCheckout, savePendingCheckout, isDefiniteCheckoutFailure } from "../src/utils/posCheckoutSession.js";
import { mergeLatestCart, hasUnavailableItems } from "../src/utils/posCart.js";
import { canProcessOrder, orderStatusLabels, paymentStatusLabels, saleChannelLabel } from "../src/utils/orderStatus.js";

function memoryStorage() {
  const records = new Map();
  return { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) };
}
test("lost-response recovery preserves the exact request and isolates employees", () => {
  const storage = memoryStorage();
  const key = pendingCheckoutKey(12);
  const payload = { requestId: "635ba6b5-3746-4cd9-afd7-0a216c2356ce", items: [{ productId: 7, quantity: 2 }], customerId: 5, pointsUsed: 1, expectedTotal: 19000, paymentMethod: "cash", cashReceived: 20000, note: "Gói riêng" };
  savePendingCheckout(storage, key, payload);
  // Simulates a new mounted page reading the same tab's storage after reload.
  const recovered = readPendingCheckout(storage, pendingCheckoutKey(12));
  assert.deepEqual(recovered.payload, payload);
  assert.equal(readPendingCheckout(storage, pendingCheckoutKey(13)), null);
  assert.equal(isDefiniteCheckoutFailure(new Error("Network response lost")), false);
  assert.equal(isDefiniteCheckoutFailure({ status: 500 }), false);
  assert.equal(isDefiniteCheckoutFailure({ status: 403 }), false);
  assert.equal(isDefiniteCheckoutFailure({ status: 404 }), false);
  assert.equal(isDefiniteCheckoutFailure({ status: 409 }), true);
  storage.removeItem(key);
  assert.equal(readPendingCheckout(storage, key), null);
});
test("unreadable or unavailable storage cannot silently lose a submitted request", () => {
  const storage = memoryStorage();
  storage.setItem("pending", "{broken");
  assert.throws(() => readPendingCheckout(storage, "pending"));
  storage.setItem("pending", JSON.stringify({ payload: { requestId: "id", items: [] } }));
  assert.throws(() => readPendingCheckout(storage, "pending"));
  assert.throws(() => savePendingCheckout({ setItem() { throw new Error("QuotaExceeded"); } }, "pending", {}));
});
test("refresh prices and stock without silently reducing quantities or removing unavailable lines", () => {
  const cart = [{ id: 1, name: "Cũ", price: 10000, quantity: 3 }, { id: 2, price: 5000, quantity: 1 }];
  const updated = mergeLatestCart(cart, [{ id: 1, productName: "Mới", price: 12000, discountPrice: 0, isActive: true, inventory: { quantity: 2 } }]);
  assert.equal(updated[0].price, 0);
  assert.equal(updated[0].quantity, 3);
  assert.equal(updated[0].stock, 2);
  assert.equal(updated[1].isActive, false);
  assert.equal(updated.length, 2);
  assert.equal(hasUnavailableItems(updated), true);
  assert.equal(cart[0].price, 10000);
  assert.equal(hasUnavailableItems(mergeLatestCart([{ id: 1, quantity: 1 }], [{ id: 1, productName: "A", price: 10000, isActive: true, inventory: { quantity: 2 } }])), false);
});
test("order progress and payment status remain separate", () => {
  assert.equal(orderStatusLabels.paid, undefined);
  assert.equal(paymentStatusLabels.paid, "Đã thanh toán");
  assert.equal(canProcessOrder({ status: "pending" }), true);
  assert.equal(canProcessOrder({ status: "processing" }), true);
  assert.equal(canProcessOrder({ status: "completed" }), false);
  assert.equal(canProcessOrder({ status: "cancelled" }), false);
});
test("missing sale-channel data must never label an online order as counter sales", () => {
  assert.equal(saleChannelLabel("mobile"), "Đơn trên app");
  assert.equal(saleChannelLabel("pos"), "Tại quầy");
  assert.equal(saleChannelLabel(undefined), "Chưa xác định");
  assert.equal(saleChannelLabel(null), "Chưa xác định");
  assert.equal(saleChannelLabel("unexpected"), "Chưa xác định");
});
