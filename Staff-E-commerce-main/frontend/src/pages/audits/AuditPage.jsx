import React from "react";
import AuditTable from "../../components/audits/AuditTable";
import AuditDetail from "../../components/audits/AuditDetail";
import { useAudit } from "../../hook/useAudit";


export default function AuditPage() {
    const {
        showAuditDetailModal,
        openAuditDetailModal,
        closeAuditDetailModal,
        listuser,
        setSelectedUser,
        setEndDate,
        setStartDate,
        listActivityLog,
        setSelectedActivityLog,
        selectedActivityLog,
        page,
        totalPages,
        fetchListActivity,
  
   

        
    } = useAudit();

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
            {/* Tiêu đề */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <svg
                        className="w-8 h-8 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    Nhật Ký Hoạt Động (Audit Log)
                </h1>
                <p className="text-gray-600 mt-1">
                    Theo dõi mọi thao tác của nhân viên trong hệ thống
                </p>
            </div>

    

            {/* Hàng 3: Bộ lọc chi tiết */}
            <div className="bg-white rounded-xl shadow-md p-5 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 ">
                            Nhân Viên
                        </label>
                        <select
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => {
                            const selectedId = e.target.value;
                            const user = listuser.find(u => u.id.toString() === selectedId);
                            setSelectedUser(user);
                            console.log("Nhân viên đang được chọn:", user);
                            }}

                            >
                            <option value="">-- Chọn user --</option>
                            {listuser.map(user => (
                                <option key={user.id} value={user.id}>
                                {user.fullName}
                                </option>
                            ))}
                        </select>

                        
                    </div>
                    {/* Ngày bắt đầu */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Ngày Bắt Đầu
                        </label>
                        <input 
                            type="date"
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        </div>

                        {/* Ngày kết thúc */}
                        <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Ngày Kết Thúc
                        </label>
                        <input
                            type="date"
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>


                    {/* Nút lọc */}
                    <div className="flex items-end">
                        <button 
                        onClick={() => fetchListActivity(1)}
                        className="w-full px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                            Lọc
                        </button>
                    </div>
                </div>
                
            </div>
            
            <AuditTable openAuditDetailModal={openAuditDetailModal} listActivityLog={listActivityLog} setSelectedActivityLog={setSelectedActivityLog} page={page} totalPages={totalPages} fetchListActivity ={fetchListActivity } />
            {showAuditDetailModal&&<AuditDetail onClose={closeAuditDetailModal} selectedActivityLog={selectedActivityLog}/>}

        </div>
    );
}
