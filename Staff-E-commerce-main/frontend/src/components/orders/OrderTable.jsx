import { Link } from "react-router-dom";
import { formatPrice } from "../../utils/formatPrice";
import { canProcessOrder, orderStatusLabels, paymentStatusLabels } from "../../utils/orderStatus";

export default function OrderTable({ showOrder, listOrders, loading, currentPage, totalPages, onPrev, onNext }) {
  return <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>
      {["Mã đơn", "Ngày tạo", "Khách hàng", "Nhân viên", "Tổng tiền", "Trạng thái đơn", "Thanh toán", "Thao tác"].map((label, i) => <th key={label} className={`whitespace-nowrap px-4 py-3 ${i === 4 ? "text-right" : i >= 5 ? "text-center" : "text-left"}`}>{label}</th>)}
    </tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">Đang tải…</td></tr> : !listOrders.length ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">Không có đơn hàng phù hợp.</td></tr> : listOrders.map((order) => <tr key={order.id} onClick={() => showOrder(order.id)} className="border-t cursor-pointer hover:bg-gray-50">
        <td className="px-4 py-3 font-medium"><button type="button" onClick={() => showOrder(order.id)} className="text-left hover:text-primary-700 hover:underline">{order.orderNumber}</button></td><td className="whitespace-nowrap px-4 py-3">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</td><td className="px-4 py-3">{order.customerName || "Khách vãng lai"}</td><td className="px-4 py-3">{order.userName || "Chưa phân công"}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(order.totalAmount)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-center">{order.status === "pending" && order.orderType === "pos" ? "Chờ thanh toán" : orderStatusLabels[order.status] || order.status}</td><td className="whitespace-nowrap px-4 py-3 text-center">{paymentStatusLabels[order.paymentStatus] || order.paymentStatus || "Chưa xác định"}</td>
        <td className="px-4 py-3 text-center"><div className="inline-flex items-center justify-center gap-2 whitespace-nowrap"><button onClick={(e) => { e.stopPropagation(); showOrder(order.id); }} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white">Xem</button>{canProcessOrder(order) && <Link to={`/pos?orderId=${order.id}`} onClick={(e) => e.stopPropagation()} className="rounded-lg border px-3 py-2 text-xs font-semibold">{order.orderType === "pos" && order.paymentStatus === "pending" ? "Thanh toán tại POS" : "Xử lý tại POS"}</Link>}</div></td>
      </tr>)}
    </tbody></table></div>
    <footer className="flex items-center justify-between border-t p-4 text-sm"><button disabled={loading || currentPage <= 1} onClick={onPrev} className="rounded border px-4 py-2 disabled:opacity-40">Trước</button><span>Trang {currentPage} / {totalPages}</span><button disabled={loading || currentPage >= totalPages} onClick={onNext} className="rounded border px-4 py-2 disabled:opacity-40">Sau</button></footer>
  </section>;
}
