import { request } from "./apiClient";

// Keep the same key for a retry of the same bill, including after a lost response.
export function getCheckoutRequestId(previous, payload) {
  const signature = JSON.stringify(payload);
  return previous?.signature === signature ? previous : { signature, id: crypto.randomUUID() };
}

export const checkoutPos = (payload) => request("/orders/checkout", { method: "POST", body: payload });
export const getPosCheckout = (id) => request(`/orders/${id}/checkout`);
export const confirmPosPayment = (id, amount, reference) => request(`/orders/${id}/confirm-payment`, { method: "POST", body: { amount, reference } });
export const createPosPaymentLink = (id) => request(`/orders/${id}/payment-link`, { method: "POST" });
