import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../api/apiClient";
import { checkoutPos, getCheckoutRequestId, getPosCheckout } from "../api/posCheckoutApi";

const initialPayment = () => ({ method: "cash", cashReceived: "", transaction_ref: "", status: "pending" });
const toProducts = (items) => items.map((item) => ({ id: item.productId, product: item.productName, qty: item.quantity, price: item.unitPrice, total: item.totalPrice }));

export const useOrders = () => {
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [ordersFormMode, setOrdersFormMode] = useState("create");
  const [currentOrder, setCurrentOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [listOrderProducts, setListOrderProducts] = useState([]);
  const [payment, setPayment] = useState(initialPayment);
  const [promotion, setPromotion] = useState(null);
  const [listOrders, setListOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const latestRequest = useRef(0);
  const checkoutRequest = useRef(null);

  const loadOrdersAdvanced = useCallback(async (page = currentPage) => {
    if (selectedStartDate && selectedEndDate && selectedStartDate > selectedEndDate) return;
    const id = ++latestRequest.current;
    const params = new URLSearchParams({ pageNumber: page, pageSize: 10 });
    if (selectedStatus) params.set("status", selectedStatus);
    if (searchKeyword.trim()) params.set("search", searchKeyword.trim());
    if (selectedStartDate) params.set("startDate", selectedStartDate);
    if (selectedEndDate) params.set("endDate", selectedEndDate);
    try {
      const result = await request(`/orders/search?${params}`);
      if (id !== latestRequest.current) return;
      setListOrders(result.items || []);
      setTotalPages(Math.max(1, result.totalPages || 1));
    } catch (e) { if (id === latestRequest.current) console.error("Không thể tải đơn hàng:", e); }
  }, [currentPage, selectedStatus, searchKeyword, selectedStartDate, selectedEndDate]);
  useEffect(() => { loadOrdersAdvanced(); }, [loadOrdersAdvanced]);

  const applyCheckout = useCallback((order) => {
    setCurrentOrder({ ...order, isPosCheckout: true, total_amount: order.totalAmount });
    setListOrderProducts(toProducts(order.items));
    setPayment({ method: order.paymentMethod === "e_wallet" ? "other" : order.paymentMethod, status: order.paymentStatus, transaction_ref: "" });
    setOrdersFormMode("detail");
  }, []);

  const refreshCheckout = useCallback((order) => {
    applyCheckout(order);
    loadOrdersAdvanced();
  }, [applyCheckout, loadOrdersAdvanced]);

  const createNewOrder = async () => {
    try {
      const order = await request("/orders/create-temp", { method: "POST" });
      checkoutRequest.current = null;
      setCurrentOrder(order); setListOrderProducts([]); setSelectedProduct(null);
      setPayment(initialPayment()); setPromotion(null); setOrdersFormMode("create"); setShowOrderModal(true);
    } catch (e) { alert(e.message || "Không thể mở đơn mới."); }
  };

  const click_buttonCreateNewOrder = async () => {
    if (submitting.current) return;
    if (!listOrderProducts.length) { alert("Vui lòng thêm sản phẩm vào đơn hàng."); return; }
    const expectedTotal = Math.max(0, Number(currentOrder.subtotal || 0) - Number(currentOrder.discount || 0));
    const payload = {
      customerId: currentOrder.customerId || null, promotionId: promotion?.id || null,
      paymentMethod: payment.method || "cash", expectedTotal,
      cashReceived: payment.method === "cash" ? Number(payment.cashReceived === "" ? expectedTotal : payment.cashReceived) : null,
      pointsUsed: 0, note: currentOrder.note || "",
      items: listOrderProducts.map((p) => ({ productId: p.id, quantity: p.qty })),
    };
    if (payment.method === "cash" && (payment.cashReceived == null || payment.cashReceived === "")) {
      alert("Nhập số tiền khách đưa trước khi thanh toán."); return;
    }
    submitting.current = true; setIsSubmitting(true);
    try {
      checkoutRequest.current = getCheckoutRequestId(checkoutRequest.current, payload);
      const order = await checkoutPos({ ...payload, requestId: checkoutRequest.current.id });
      applyCheckout(order);
      await loadOrdersAdvanced(1); setCurrentPage(1);
    } catch (e) { alert(e.message || "Chưa nhận được kết quả. Giữ nguyên giỏ và thử lại để tránh tạo trùng."); }
    finally { submitting.current = false; setIsSubmitting(false); }
  };

  const showOrderById = useCallback(async (id) => {
    try {
      const order = await request(`/orders/${id}`);
      if (order.isPosCheckout) {
        applyCheckout(await getPosCheckout(id));
      } else {
        const [items, savedPayment] = await Promise.allSettled([request(`/orders/${id}/items`), request(`/payment/getbyorder/${id}`)]);
        setCurrentOrder(order); setOrdersFormMode("detail");
        setListOrderProducts(items.status === "fulfilled" ? toProducts(items.value) : []);
        setPayment(savedPayment.status === "fulfilled" ? savedPayment.value : initialPayment());
      }
      setPromotion(order.promotionId ? await request(`/promotions/${order.promotionId}`).catch(() => null) : null);
      setSelectedProduct(null); setShowOrderModal(true);
    } catch (e) { alert(e.message || "Không thể mở chi tiết đơn."); }
  }, [applyCheckout]);

  const cancelOrder = async (id) => {
    if (!window.confirm("Hủy đơn chưa thanh toán này?")) return;
    try {
      const result = await request(`/orders/${id}/cancel`, { method: "POST" });
      if (result !== true) throw new Error("Không thể hủy đơn. Hãy kiểm tra trạng thái thanh toán.");
      await loadOrdersAdvanced();
    } catch (e) { alert(e.message); }
  };
  const completePendingOrder = async (id) => {
    try {
      await request(`/orders/${id}/complete`, { method: "POST" });
      await showOrderById(id); await loadOrdersAdvanced();
    } catch (e) { alert(e.message); }
  };

  return {
    showCustomerModal, showProductModal, showOrderModal, ordersFormMode, currentOrder, setCurrentOrder,
    selectedProduct, setSelectedProduct, listOrderProducts, setListOrderProducts, payment, setPayment, promotion, setPromotion,
    listOrders, currentPage, totalPages, setCurrentPage, selectedStatus, setSelectedStatus,
    selectedStartDate, setSelectedStartDate, selectedEndDate, setSelectedEndDate, searchKeyword, setSearchKeyword,
    loadOrdersAdvanced, createNewOrder, click_buttonCreateNewOrder, isSubmitting, refreshCheckout,
    showOrderById, showOrder: (index) => showOrderById(listOrders[index].id), cancelOrder, completePendingOrder,
    closeOrderModal: () => { if (!submitting.current) setShowOrderModal(false); },
    openCustomerModal: () => setShowCustomerModal(true), closeCustomerModal: () => setShowCustomerModal(false),
    openProductModal: () => setShowProductModal(true), closeProductModal: () => setShowProductModal(false),
    updateCustomer: (customer) => {
      setCurrentOrder((previous) => ({ ...previous, customerId: customer?.id ?? null, customerName: customer?.fullName ?? "Khách vãng lai" }));
      setShowCustomerModal(false);
    },
  };
};
