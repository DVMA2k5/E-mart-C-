// src/pages/inventory/InventoryList.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  getInventoryPaginated,
  adjustInventory,
  getInventoryStats,
} from "../../api/inventoryApi";
import { formatPrice } from "../../utils/formatPrice";
import { useAuth } from "../../hook/useAuth";

export default function InventoryList() {
  const { user } = useAuth();
  const isStaff = user?.role?.toLowerCase() === "staff";

  // --- state
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    totalItems: 0,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState("id");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modal state
  const [adjustModal, setAdjustModal] = useState({
    open: false,
    item: null,
    newQuantity: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  // Thống kê
  const [stats, setStats] = useState({
    total: 0,
    outOfStock: 0,
    lowStock: 0,
    inStock: 0,
  });

  // --- debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 450);

    return () => clearTimeout(t);
  }, [search]);

  // --- fetchInventory: stable function
  const fetchInventory = useCallback(
    async (p = 1, ps = pageSize, q = "", status = "") => {
      let showLoader = true;
      const loaderTimer = setTimeout(() => {
        if (showLoader) setLoading(true);
      }, 150);

      setError(null);
      try {
        const data = await getInventoryPaginated(p, ps, q, sortBy, status);
        console.log("📦 Inventory data received:", data);

        // Đảm bảo dữ liệu được xử lý đúng
        const items = Array.isArray(data.items) ? data.items : [];
        setItems(items);

        setMeta({
          totalItems: data.totalItems || 0,
          currentPage: data.currentPage || 1,
          pageSize: data.pageSize || ps,
          totalPages: data.totalPages || 1,
          hasNext: data.hasNext || false,
          hasPrevious: data.hasPrevious || false,
        });
      } catch (err) {
        console.error("❌ Lỗi khi tải danh sách tồn kho:", err);
        setError(err.message || "Không thể tải danh sách tồn kho");
        setItems([]);
      } finally {
        clearTimeout(loaderTimer);
        showLoader = false;
        setLoading(false);
      }
    },
    [pageSize, sortBy]
  );

  // --- fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getInventoryStats();
      console.log("📊 Inventory stats received:", statsData);
      setStats({
        total: statsData.total || 0,
        outOfStock: statsData.outOfStock || 0,
        lowStock: statsData.lowStock || 0,
        inStock: statsData.inStock || 0,
      });
    } catch (err) {
      console.error("❌ Lỗi khi tải thống kê:", err);
      // Fallback: thử cách cũ nếu endpoint mới không hoạt động
      try {
        const [all, outOfStock, lowStock, inStock] = await Promise.all([
          getInventoryPaginated(1, 1, "", "", ""),
          getInventoryPaginated(1, 1, "", "", "out_of_stock"),
          getInventoryPaginated(1, 1, "", "", "low_stock"),
          getInventoryPaginated(1, 1, "", "", "in_stock"),
        ]);

        setStats({
          total: all.totalItems || 0,
          outOfStock: outOfStock.totalItems || 0,
          lowStock: lowStock.totalItems || 0,
          inStock: inStock.totalItems || 0,
        });
      } catch (fallbackErr) {
        console.error("❌ Lỗi khi tải thống kê (fallback):", fallbackErr);
      }
    }
  }, []);

  // --- fetch khi page, debouncedSearch, sortBy, stockStatus thay đổi
  useEffect(() => {
    fetchInventory(page, pageSize, debouncedSearch, stockStatus);
  }, [page, debouncedSearch, sortBy, stockStatus, fetchInventory, pageSize]);

  // --- fetch stats khi component mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // --- handlers
  const openAdjustModal = (item) => {
    setAdjustModal({
      open: true,
      item,
      newQuantity: item.quantity.toString(),
      reason: "",
    });
  };

  const closeAdjustModal = () => {
    setAdjustModal({
      open: false,
      item: null,
      newQuantity: "",
      reason: "",
    });
    setNotification(null);
  };

  const handleAdjustInventory = async () => {
    if (!adjustModal.item) return;

    const newQty = parseInt(adjustModal.newQuantity);
    if (isNaN(newQty) || newQty < 0) {
      setNotification({
        type: "error",
        message: "Số lượng phải là số nguyên dương",
      });
      return;
    }

    setSaving(true);
    setNotification(null);

    try {
      await adjustInventory(adjustModal.item.id, newQty, adjustModal.reason);
      setNotification({
        type: "success",
        message: "Cập nhật số lượng tồn kho thành công",
      });

      // Refresh data
      await fetchInventory(page, pageSize, debouncedSearch, stockStatus);
      await fetchStats();

      setTimeout(() => {
        closeAdjustModal();
      }, 1500);
    } catch (err) {
      console.error("Lỗi khi cập nhật tồn kho:", err);
      setNotification({
        type: "error",
        message: err.message || "Không thể cập nhật tồn kho",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    fetchInventory(page, pageSize, debouncedSearch, stockStatus);
    fetchStats();
  };

  // --- helpers
  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getQuantityColor = (quantity) => {
    if (quantity === 0) return "text-red-600 font-semibold";
    if (quantity < 10) return "text-orange-600 font-semibold";
    return "text-green-600";
  };

  const getQuantityBadge = (quantity) => {
    if (quantity === 0)
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          Hết hàng
        </span>
      );
    if (quantity < 10)
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
          Sắp hết
        </span>
      );
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
        Còn hàng
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            Quản lý Tồn kho
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
              title="Làm mới"
            >
              🔄
            </button>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-indigo-300"
            />
          </div>
        </div>

        {/* Thống kê */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded-md shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-600">Tổng sản phẩm</div>
            <div className="text-2xl font-bold text-gray-800">
              {stats.total}
            </div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border-l-4 border-red-500">
            <div className="text-sm text-gray-600">Hết hàng</div>
            <div className="text-2xl font-bold text-red-600">
              {stats.outOfStock}
            </div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-600">Sắp hết hàng</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.lowStock}
            </div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Còn hàng</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.inStock}
            </div>
          </div>
        </div>

        {/* Bộ lọc */}
        <div className="bg-white p-4 rounded-md shadow-sm mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Trạng thái tồn kho
              </label>
              <select
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-indigo-300 text-sm"
              >
                <option value="">Tất cả</option>
                <option value="out_of_stock">Hết hàng</option>
                <option value="low_stock">Sắp hết hàng (&lt; 10)</option>
                <option value="in_stock">Còn hàng (≥ 10)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Sắp xếp theo
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-indigo-300 text-sm"
              >
                <option value="id">Mã ID</option>
                <option value="quantity_desc">Số lượng (Cao → Thấp)</option>
                <option value="quantity_asc">Số lượng (Thấp → Cao)</option>
                <option value="price_desc">Giá (Cao → Thấp)</option>
                <option value="price_asc">Giá (Thấp → Cao)</option>
                <option value="product_name_asc">Tên sản phẩm (A-Z)</option>
                <option value="product_name_desc">Tên sản phẩm (Z-A)</option>
                <option value="updated_at_desc">Cập nhật mới nhất</option>
                <option value="updated_at_asc">Cập nhật cũ nhất</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className={`mb-3 p-3 rounded ${
              notification.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-md shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Mã SP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Tên sản phẩm
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Danh mục
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Giá
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  ĐVT
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Số lượng tồn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Cập nhật lần cuối
                </th>
                {!isStaff && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                    Hành động
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center">
                    Đang tải...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Không có dữ liệu tồn kho
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id ?? idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(meta.currentPage - 1) * meta.pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.productId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                      {item.productName || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.categoryName || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-indigo-600 font-semibold">
                      {item.price ? formatPrice(item.price) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {item.unit || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={getQuantityColor(item.quantity)}>
                          {item.quantity ?? 0}
                        </span>
                        {getQuantityBadge(item.quantity)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(item.updatedAt)}
                    </td>
                    {!isStaff && (
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => openAdjustModal(item)}
                          className="px-3 py-1 bg-indigo-100 rounded text-indigo-800 hover:bg-indigo-200 text-sm"
                        >
                          Điều chỉnh
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Hiển thị{" "}
            <strong>
              {(meta.currentPage - 1) * meta.pageSize + 1} -{" "}
              {Math.min(meta.currentPage * meta.pageSize, meta.totalItems)}
            </strong>{" "}
            / {meta.totalItems} sản phẩm
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              onClick={() => setPage(1)}
              disabled={meta.currentPage === 1}
            >
              Đầu
            </button>
            <button
              className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              onClick={() => setPage(Math.max(1, meta.currentPage - 1))}
              disabled={!meta.hasPrevious}
            >
              Trước
            </button>

            <span className="px-3 py-1 rounded-md bg-white border">
              {meta.currentPage} / {meta.totalPages}
            </span>

            <button
              className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              onClick={() =>
                setPage(Math.min(meta.totalPages, meta.currentPage + 1))
              }
              disabled={!meta.hasNext}
            >
              Sau
            </button>
            <button
              className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              onClick={() => setPage(meta.totalPages)}
              disabled={meta.currentPage === meta.totalPages}
            >
              Cuối
            </button>
          </div>
        </div>
      </div>

      {/* Modal điều chỉnh tồn kho */}
      {adjustModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              Điều chỉnh số lượng tồn kho
            </h2>

            {adjustModal.item && (
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Sản phẩm:</strong> {adjustModal.item.productName}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <strong>SKU:</strong> {adjustModal.item.sku || "—"}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  <strong>Số lượng hiện tại:</strong>{" "}
                  <span className="font-semibold text-indigo-600">
                    {adjustModal.item.quantity}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số lượng mới <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={adjustModal.newQuantity}
                onChange={(e) =>
                  setAdjustModal({
                    ...adjustModal,
                    newQuantity: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-indigo-300"
                placeholder="Nhập số lượng"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do điều chỉnh (tùy chọn)
              </label>
              <textarea
                value={adjustModal.reason}
                onChange={(e) =>
                  setAdjustModal({ ...adjustModal, reason: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-indigo-300"
                rows="3"
                placeholder="Nhập lý do điều chỉnh..."
              />
            </div>

            {notification && (
              <div
                className={`mb-4 p-3 rounded ${
                  notification.type === "success"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {notification.message}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeAdjustModal}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                disabled={saving}
              >
                Hủy
              </button>
              <button
                onClick={handleAdjustInventory}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
