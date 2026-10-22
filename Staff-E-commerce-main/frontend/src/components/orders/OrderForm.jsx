import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hook/useAuth";
import { formatPrice } from "../../utils/formatPrice";
import { canProcessOrder, orderStatusLabels, paymentStatusLabels, paymentMethodLabels, saleChannelLabel } from "../../utils/orderStatus";

export default function OrdersForm({ onClose, currentOrder: order }) {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "—";
  const normalizeName = (value) => (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
  const hasDeliveryDetails = Boolean(order.orderType === "mobile" || order.recipientName || order.shippingAddress);
  const sameDisplayName = Boolean(normalizeName(order.recipientName))
    && normalizeName(order.customerName) === normalizeName(order.recipientName);
  const fields = [
    ["Mã đơn hàng", order.orderNumber], ["Kênh bán", saleChannelLabel(order.orderType)],
    ...(!sameDisplayName ? [[hasDeliveryDetails ? "Khách hàng đặt đơn" : "Khách hàng", order.customerName || "Khách vãng lai"]] : []),
    ["Nhân viên", order.userName || "Chưa phân công"],
    ["Ngày tạo", date(order.createdAt)], ["Ngày cập nhật", date(order.updatedAt)],
    ["Trạng thái đơn", orderStatusLabels[order.status] || order.status],
    ["Trạng thái thanh toán", paymentStatusLabels[order.paymentStatus] || order.paymentStatus || "Chưa xác định"],
    ["Phương thức thanh toán", paymentMethodLabels[order.paymentMethod] || order.paymentMethod || "Chưa xác định"],
  ];
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <header className="mb-5 flex items-center justify-between border-b pb-4"><h1 id="order-detail-title" className="text-xl font-bold">CHI TIẾT ĐƠN HÀNG</h1><button onClick={onClose} aria-label="Đóng" className="px-3 py-1 text-xl">×</button></header>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
      {hasDeliveryDetails && <section className="my-5 rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Thông tin người nhận</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Tên người nhận</dt><dd className="mt-1 font-medium">{order.recipientName || "Chưa xác định"}</dd></div>
          <div><dt className="text-gray-500">Số điện thoại người nhận</dt><dd className="mt-1 font-medium">{order.recipientPhone || "Chưa xác định"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Địa chỉ giao hàng</dt><dd className="mt-1 whitespace-pre-line break-words font-medium">{order.shippingAddress || "Chưa xác định"}</dd></div>
        </dl>
      </section>}
      <div className="my-5"><h2 className="mb-2 font-semibold">Ghi chú đơn hàng</h2><p className="whitespace-pre-line break-words rounded-lg bg-gray-50 p-3 text-sm">{order.note?.trim() || "Không có ghi chú"}</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Sản phẩm</th><th className="p-3 text-right">Số lượng</th><th className="p-3 text-right">Đơn giá</th><th className="p-3 text-right">Thành tiền</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.productName}</td><td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{formatPrice(item.unitPrice)}</td><td className="p-3 text-right">{formatPrice(item.totalPrice)}</td></tr>)}</tbody></table></div>
      <div className="my-5 space-y-2 rounded-lg bg-gray-50 p-4">{[["Tạm tính", order.subtotal], ["Giảm giá", order.discount], ["Tổng tiền", order.totalAmount]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><span>{label}</span><strong>{formatPrice(value)}</strong></div>)}</div>
      <footer className="flex flex-wrap justify-end gap-3">
        {permissions.includes("invoices.read") && (order.status === "completed" || order.status === "processing" || order.paymentStatus === "paid") && <button onClick={() => navigate(`/invoices?orderId=${order.id}`)} className="rounded-lg border px-4 py-2">Xem hóa đơn</button>}
        {canProcessOrder(order) && <button onClick={() => navigate(`/pos?orderId=${order.id}`)} className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white">{order.orderType === "pos" && order.paymentStatus === "pending" ? "Thanh toán tại POS" : "Xử lý tại POS"}</button>}
      </footer>
    </section>
  </div>;
}
