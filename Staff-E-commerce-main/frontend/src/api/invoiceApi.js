import { request } from "./apiClient";

export function getInvoices({ page = 1, pageSize = 10, from = "", to = "", paymentStatus = "", customerSearch = "" } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (paymentStatus) params.set("paymentStatus", paymentStatus);
  if (customerSearch.trim()) params.set("customerSearch", customerSearch.trim());
  return request(`/invoice?${params}`);
}

export const getInvoice = (orderId) => request(`/invoice/${orderId}`);
