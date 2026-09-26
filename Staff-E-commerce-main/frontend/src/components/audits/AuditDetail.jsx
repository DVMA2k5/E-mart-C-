import React from "react";

export default function AuditDetail({ onClose ,selectedActivityLog}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Chi Tiết Hoạt Động</h3>
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

        {/* Nội dung chi tiết */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Thời gian:</strong>{" "}
              <span>{selectedActivityLog.createdAt}</span>
            </div>
            <div>
              <strong>Nhân viên:</strong>{" "}
              <span>{selectedActivityLog.username}</span>
            </div>
            <div>
              <strong>Hành động:</strong>{" "}
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                {selectedActivityLog.action}
              </span>
            </div>
            <div>
              <strong>Đối tượng:</strong>{" "}
              <span className="text-blue-600 font-medium">{selectedActivityLog.entityType}</span>
            </div>
            <div>
              <strong>IP:</strong>{" "}
              <span>{selectedActivityLog.ipAddress}</span>
            </div>
          </div>

          <div>
            <strong>Payload (JSON):</strong>
            <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto font-mono whitespace-pre-wrap">
              {selectedActivityLog.payload}
            </pre>
          </div>
        </div>
      </div>
      
    </div>
  );
}
