import { Link } from "react-router-dom";
import { formatPrice } from "../../utils/formatPrice";
import { canProcessOrder, orderStatusLabels, paymentMethodLabels } from "../../utils/orderStatus";

export default function OrderTable({ showOrder, selectedOrderId, listOrders, loading, currentPage, totalPages, onPrev, onNext, pageSize, compact = true }) {
  return <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="management-table-scroll" key={`${currentPage}-${pageSize}`}><table className="management-table w-full table-auto text-sm" data-compact={compact}><thead className="bg-gray-50"><tr>
      {["Mã đơn hàng", "Ngày tạo", "Khách hàng", "Số lượng SP", "Tổng tiền", "Trạng thái đơn hàng", "Phương thức thanh toán", "Nhân viên phụ trách", "Thao tác"].map((label, i) => <th key={label} className={`px-4 py-3 ${i === 3 || i === 4 ? "text-right" : i === 5 || i === 6 ? "text-center" : "text-left"}`}>{label}</th>)}
    </tr></thead><tbody>
      {loading ? <tr><td colSpan={9} className="p-8 text-center text-gray-500">Đang tải…</td></tr> : !listOrders.length ? <tr><td colSpan={9} className="p-8 text-center text-gray-500">Không có đơn hàng phù hợp.</td></tr> : listOrders.map((order) => <tr key={order.id} onClick={() => showOrder(order.id)} className={`border-t cursor-pointer hover:bg-primary-50 ${selectedOrderId === order.id ? "bg-primary-50" : ""}`}>
        <td className="px-4 py-3 font-medium text-primary-700">{order.orderNumber}</td><td className="px-4 py-3">{new Date(order.createdAt).toLocaleString("vi-VN")}</td><td className="px-4 py-3">{order.customerName || "Khách vãng lai"}</td><td className="px-4 py-3 text-right">{order.totalQuantity || 0}</td><td className="px-4 py-3 text-right font-semibold">{formatPrice(order.totalAmount)}</td>
        <td className="px-4 py-3 text-center">{order.status === "pending" && order.orderType === "pos" ? "Chờ thanh toán" : orderStatusLabels[order.status] || order.status}</td><td className="px-4 py-3 text-center">{paymentMethodLabels[order.paymentMethod] || order.paymentMethod || "Chưa xác định"}</td><td className="px-4 py-3">{order.userName || "Chưa phân công"}</td>
        <td className="px-4 py-3 text-center"><div className="table-actions inline-flex items-center justify-center gap-2">{canProcessOrder(order) ? <Link to={`/pos?orderId=${order.id}`} onClick={(e) => e.stopPropagation()} className="rounded-lg border px-3 py-2 text-xs font-semibold">{order.orderType === "pos" && order.paymentStatus === "pending" ? "Thanh toán" : "Xử lý"}</Link> : <span className="text-gray-400">—</span>}</div></td>
      </tr>)}
    </tbody></table></div>
    <footer className="flex items-center justify-between border-t px-3 py-2 text-sm"><button disabled={loading || currentPage <= 1} onClick={onPrev} className="min-h-8 rounded border px-3 py-1 disabled:opacity-40">Trước</button><span>Trang {currentPage} / {totalPages}</span><button disabled={loading || currentPage >= totalPages} onClick={onNext} className="min-h-8 rounded border px-3 py-1 disabled:opacity-40">Sau</button></footer>
  </section>;
}
