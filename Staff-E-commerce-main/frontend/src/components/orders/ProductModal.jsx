import { useEffect, useState } from "react";
import { request } from "../../api/apiClient";

export default function ProductModal({ onClose, selectedProduct, setSelectedProduct }) {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -------------------------------
  // Fetch sản phẩm
  // -------------------------------
  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page, pageSize, status: 1, stockStatus: "available" });
      if (searchMode && searchInput.trim()) params.set("search", searchInput.trim());
      const url = `/products/paginated?${params}`;

      const data = await request(url);
      if (!active) return;

      setProducts(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (active) setError(err.message || "Không thể tải sản phẩm.");
    } finally {
      if (active) setLoading(false);
    }
    };
    fetchProducts();
    return () => { active = false; };
  }, [page, pageSize, searchMode, searchInput]);

  // -------------------------------
  // Nhấn chọn sản phẩm
  // -------------------------------
  const handleSelect = () => {
    if (selectedProduct) {
      // Chuẩn hóa dữ liệu
      const normalized = {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price: Number(selectedProduct.discountPrice ?? selectedProduct.price ?? 0),
        quantity: selectedProduct.quantity
      };
      setSelectedProduct(normalized); // Cập nhật lên component cha
      onClose(); // Đóng modal
    }
  };

  const handleReset = () => {
    setSearchMode(false);
    setSearchInput("");
    setPage(1);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-xl font-bold">Chọn Sản Phẩm</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Tìm kiếm */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Tìm sản phẩm..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              onClick={() => { setPage(1); setSearchMode(true); }}
            >
              Tìm kiếm
            </button>
            {searchMode && (
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={handleReset}
              >
                Xem tất cả
              </button>
            )}
          </div>

          {/* Bảng sản phẩm */}
          {error && <p role="alert" className="mb-3 text-red-600">{error}</p>}
          {loading ? (
            <div className="text-center py-10">Đang tải...</div>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Mã </th>
                    <th className="px-4 py-2 text-left">Tên SP</th>
                    <th className="px-4 py-2 text-right">Giá</th>
                    <th className="px-4 py-2 text-center">Chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        Không có sản phẩm
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedProduct?.id === p.id ? "bg-primary-50" : ""
                        }`}
                        onClick={() => setSelectedProduct({ id: p.id, name: p.productName, price: p.discountPrice ?? p.price, quantity: p.inventory?.quantity ?? 0})}
                      >
                        <td className="px-4 py-2">{p.id}</td>
                        <td className="px-4 py-2">{p.productName}</td>
                        <td className="px-4 py-2 text-right font-bold">
                          {(p.discountPrice ?? p.price)?.toLocaleString()}₫
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="radio"
                            name="selectedProduct"
                            checked={selectedProduct?.id === p.id}
                            onChange={() => setSelectedProduct({ id: p.id, name: p.productName, price: p.discountPrice ?? p.price, quantity: p.inventory?.quantity ?? 0})}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {(
          <div className="flex justify-center items-center gap-3 mt-4">
            <button
              className="px-3 py-1 bg-primary-600 text-white rounded disabled:opacity-50 hover:bg-primary-700"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button
              className="px-3 py-1 bg-primary-600 text-white rounded disabled:opacity-50 hover:bg-primary-700"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t">
          <button
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50"
            onClick={handleSelect}
            disabled={!selectedProduct}
          >
            Chọn Sản Phẩm
          </button>
        </div>
      </div>
    </div>
  );
}
