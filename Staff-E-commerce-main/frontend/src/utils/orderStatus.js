export const orderStatusLabels = {
  pending: "Chờ xử lý", processing: "Đang xử lý", delivering: "Đang giao hàng",
  completed: "Hoàn thành", cancelled: "Đã hủy", refunded: "Đã hoàn tiền",
};
export const paymentStatusLabels = {
  pending: "Chờ thanh toán", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền",
};
export const paymentMethodLabels = { cash: "Tiền mặt", e_wallet: "MoMo", other: "MoMo", card: "Thẻ/ngân hàng (đơn cũ)" };
export const saleChannelLabel = (type) => ({ mobile: "Đơn trên app", pos: "Tại quầy" }[type] || "Chưa xác định");
export const canProcessOrder = (order) => ["pending", "processing", "delivering"].includes(order.status);
