import { request } from "./apiClient";

// Keep the same key for a retry of the same bill, including after a lost response.
export function getCheckoutRequestId(previous, payload) {
  const signature = JSON.stringify(payload);
  return previous?.signature === signature ? previous : { signature, id: crypto.randomUUID() };
}

export const checkoutPos = (payload) => request("/orders/checkout", { method: "POST", body: payload });
export const getPosCheckout = (id) => request(`/orders/${id}/checkout`);
export const findPosCheckoutByRequest = (requestId) => request(`/orders/checkout-request/${requestId}`).catch((error) => {
  if (error.status === 404) return null;
  throw error;
});
export const confirmPosPayment = (id, amount, reference) => request(`/orders/${id}/confirm-payment`, { method: "POST", body: { amount, reference } });
export const createPosPaymentLink = (id) => request(`/orders/${id}/payment-link`, { method: "POST" });
export const confirmPosCash = (id, cashReceived) => request(`/orders/${id}/confirm-cash`, { method: "POST", body: { cashReceived } });
