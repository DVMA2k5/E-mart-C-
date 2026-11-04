import { request } from "./apiClient";

// Lấy danh sách đơn hàng online (order_type = 'mobile')
export async function getOnlineOrders(pageNumber = 1, pageSize = 20, status = '', search = '', fromDate = '', toDate = '') {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
    ...(status && { status }),
    ...(search && { search }),
    ...(fromDate && { fromDate }),
    ...(toDate && { toDate }),
  });
  return request(`/orders/online?${params}`);
}

// Nhân viên xác nhận đã nhận chuyển khoản cho đơn thanh toán VietQR
export async function confirmOnlineTransfer(orderId, reference = '') {
  return request(`/orders/${orderId}/confirm-transfer`, { method: 'POST', body: { reference } });
}

// Lịch sử thay đổi trạng thái đơn
export async function getOrderHistory(orderId) {
  return request(`/orders/${orderId}/history`);
}

// Xác nhận đơn hàng (pending -> processing)
export async function confirmOnlineOrder(orderId) {
  return request(`/orders/${orderId}/confirm`, { method: 'POST' });
}

// Từ chối đơn hàng (pending|processing -> cancelled)
export async function rejectOnlineOrder(orderId, reason = '') {
  return request(`/orders/${orderId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Hoàn thành giao hàng (processing -> completed)
export async function deliverOnlineOrder(orderId) {
  return request(`/orders/${orderId}/deliver`, { method: 'POST' });
}

// Lấy items của 1 đơn hàng
export async function getOrderItems(orderId) {
  return request(`/orders/${orderId}/items`);
}

export default {
  getOnlineOrders,
  confirmOnlineOrder,
  rejectOnlineOrder,
  deliverOnlineOrder,
  getOrderItems,
};
