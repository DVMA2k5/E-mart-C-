import React, { useState, useEffect } from "react";

export default function CustomerModal({ onClose, updateCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState(false);

  const [loading, setLoading] = useState(false);

  // Fetch danh sách khách hàng
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let url = "";
      if (searchMode && searchInput.trim() !== "") {
        // Tìm kiếm -> lấy tất cả
        const params = new URLSearchParams({ keyword: searchInput });
        url = `/api/customers/search?${params.toString()}`;
      } else {
        // Phân trang bình thường
        const params = new URLSearchParams({ page, pageSize });
        url = `/api/customers/paginated?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch customers");

      const data = await res.json();

      if (searchMode) {
        setCustomers(data || []);
        setPage(1);
        setTotalPages(1);
      } else {
        setCustomers(data.items || []);
        setTotalPages(data.totalPages || 1);
      }

      setSelectedCustomerId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchMode) {
      fetchCustomers();
    }
  }, [page]);


  const handleSelect = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) {
      updateCustomer(customer);
      onClose();
    }
  };

  const handleResetSearch = () => {
    setSearchMode(false);
    setSearchInput("");
    setPage(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-xl font-bold">Chọn Khách Hàng</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Tìm khách..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={() => {
                setPage(1);
                setSearchMode(true);
                fetchCustomers();
              }}
            >
              Tìm kiếm
            </button>


            {searchMode && (
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={handleResetSearch}
              >
                Xem tất cả
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10">Đang tải...</div>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Mã Khách</th>
                    <th className="px-4 py-2 text-left">Tên Khách</th>
                    <th className="px-4 py-2 text-center">Chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-4">Không có khách hàng</td>
                    </tr>
                  ) : (
                    customers.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-2">{c.id}</td>
                        <td className="px-4 py-2">{c.fullName}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="radio"
                            name="selectedCustomer"
                            checked={selectedCustomerId === c.id}
                            onChange={() => setSelectedCustomerId(c.id)}
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
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-gray-300"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-gray-300"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t">
          <button
            className="px-6 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSelect}
            disabled={!selectedCustomerId}
          >
            Chọn Khách
          </button>
        </div>

      </div>
    </div>
  );
}
