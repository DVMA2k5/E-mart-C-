import { useState, useEffect } from 'react';


export const useAudit = () => {
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedActivityLog, setSelectedActivityLog] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [listActivityLog, setListActivityLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listuser,setListUsers]= useState([]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch("http://localhost:5099/api/users/getalluser"); // URL API của bạn
      if (!res.ok) throw new Error("Không thể tải danh sách người dùng");
      const data = await res.json();
      setListUsers(data);
    } catch (error) {
      console.error("Lỗi khi gọi API:", error);
    }
  };

  useEffect(() => {
    fetchAllUsers();
    fetchListActivity(page, pageSize); 
  }, []);


  async function getPagedLogs(page = 1, size = 10) {
    try {
      const res = await fetch(`http://localhost:5099/api/activitylog/paged?page=${page}&size=${size}`);
      if (!res.ok) throw new Error(`Lỗi: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error("Lỗi khi gọi API getPagedLogs:", error);
      return null;
    }
  }

  async function getFilteredLogs({ page = 1, size = 10, userId = null, startDate = null, endDate = null }) {
    try {
      const params = new URLSearchParams({ page, size });
      if (userId) params.append("userId", userId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`http://localhost:5099/api/activitylog/filter?${params.toString()}`);
      if (!res.ok) throw new Error(`Lỗi: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error("Lỗi khi gọi API getFilteredLogs:", error);
      return null;
    }
  }

  const fetchListActivity = async (pageParam = page, size = pageSize) => {
    setLoading(true);
    try {
      let data;

      // Kiểm tra ngày hợp lệ
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc!");
        setLoading(false);
        return;
      }

      if (selectedUser || (startDate && endDate)) {
        data = await getFilteredLogs({
          page: pageParam,
          size,
          userId: selectedUser?.id ?? null,
          startDate,
          endDate
        });
      } else {
        data = await getPagedLogs(pageParam, size);
      }

      if (data) {
        setListActivityLog(data.data || []);
        setTotalPages(Math.ceil(data.total / size));
        setPage(data.page);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách activity log:", err);
    } finally {
      setLoading(false);
    }
  };




  
  // Khi chọn một activity log trong danh sách
  const handleSelectActivityLog = (activityLog) => {
    setSelectedActivityLog(activityLog);
    openAuditDetailModal(); // Mở modal chi tiết
  };


  const openAuditDetailModal = () => setShowAuditDetailModal(true);
  const closeAuditDetailModal = () => setShowAuditDetailModal(false);

  return {
    showAuditDetailModal,
    openAuditDetailModal,
    closeAuditDetailModal,
    selectedUser,
    setSelectedUser,
    selectedActivityLog,
    setSelectedActivityLog,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    pageSize,
    totalPages,
    setTotalPages,
    listActivityLog,
    loading,
    fetchListActivity,
    listuser,
    setListUsers,
    fetchAllUsers,
    handleSelectActivityLog

  };
};
