import React from "react";

export default function AuditTable({
  openAuditDetailModal,
  listActivityLog,
  setSelectedActivityLog,
  page,
  totalPages,
  fetchListActivity,
}) {
  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-bold">Thời gian</th>
              <th className="px-5 py-3 text-left font-bold">Nhân viên</th>
              <th className="px-5 py-3 text-left font-bold">Hành động</th>
              <th className="px-5 py-3 text-left font-bold">Đối tượng</th>
              <th className="px-5 py-3 text-left font-bold">Chi tiết</th>
              <th className="px-5 py-3 text-left font-bold">IP</th>
              <th className="px-5 py-3 text-left font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listActivityLog && listActivityLog.length > 0 ? (
              listActivityLog.map((activityLog, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-5 py-3 text-xs font-medium">
                    {activityLog.createdAt}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {activityLog.username}
                  </td>
                  <td className="px-5 py-3">
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                      {activityLog.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {activityLog.entityType}
                  </td>
                  <td
                    className="px-5 py-3 text-xs text-gray-600 truncate max-w-xs"
                    title={activityLog.payload}
                  >
                    {activityLog.payload}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {activityLog.ipAddress}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                      onClick={() => {
                        setSelectedActivityLog(activityLog);
                        openAuditDetailModal(); // gọi hàm
                      }}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="text-center text-gray-500 py-4 italic"
                >
                  Không có dữ liệu hoạt động nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <button
          onClick={() => fetchListActivity(page - 1)}
          className="px-5 py-2 border rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
          disabled={page <= 1}
        >
          Prev
        </button>
        <span className="text-sm font-medium">
          Trang <strong>{page}</strong> / <strong>{totalPages}</strong>
        </span>
        <button
          onClick={() => fetchListActivity(page + 1)}
          className="px-5 py-2 border rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
