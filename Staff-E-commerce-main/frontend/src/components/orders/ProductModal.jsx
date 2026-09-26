import { useEffect, useState } from "react";

export default function ProductModal({ onClose, selectedProduct, setSelectedProduct }) {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // -------------------------------
  // Fetch sản phẩm
  // -------------------------------
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = "";
      if (searchMode && searchInput.trim() !== "") {
        const params = new URLSearchParams({ keyword: searchInput });
        url = `/api/products/search?${params.toString()}`;
      } else {
        const params = new URLSearchParams({ page, pageSize });
        url = `/api/products/available?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      console.log("Danh sách sản phẩm còn hàng",data);
      

      if (searchMode) {
        setProducts(data || []);
        setTotalPages(1);
        setPage(1);
      } else {
        setProducts(data.items || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, searchMode]);

  // -------------------------------
  // Nhấn chọn sản phẩm
  // -------------------------------
  const handleSelect = () => {
    if (selectedProduct) {
      // Chuẩn hóa dữ liệu
      const normalized = {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price: Number(selectedProduct.price ?? 0),
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={() => setSearchMode(true)}
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
                          selectedProduct?.id === p.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedProduct({ id: p.id, name: p.productName, price: p.price, quantity: p.inventory.quantity})}
                      >
                        <td className="px-4 py-2">{p.id}</td>
                        <td className="px-4 py-2">{p.productName}</td>
                        <td className="px-4 py-2 text-right font-bold">
                          {p.price?.toLocaleString()}₫
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="radio"
                            name="selectedProduct"
                            checked={selectedProduct?.id === p.id}
                            onChange={() => setSelectedProduct({ id: p.id, name: p.productName, price: p.price, quantity: p.inventory.quantity})}
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
        {!searchMode && (
          <div className="flex justify-center items-center gap-3 mt-4">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
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
            className="px-6 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50"
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
