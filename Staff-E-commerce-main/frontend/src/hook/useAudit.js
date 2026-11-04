import { useState, useEffect } from 'react';
import { request } from '../api/apiClient';


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
  const [error, setError] = useState("");
  const [listuser,setListUsers]= useState([]);

  // The user filter needs users.read; without it the log list still works, only the filter stays empty.
  const fetchAllUsers = async () => {
    try {
      const data = await request("/users/getalluser");
      setListUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Không tải được danh sách người dùng cho bộ lọc:", error.message);
      setListUsers([]);
    }
  };

  useEffect(() => {
    fetchAllUsers();
    fetchListActivity(page, pageSize);
  }, []);


  // Requests go through the shared client so the bearer token is sent.
  function getPagedLogs(page = 1, size = 10) {
    return request(`/activitylog/paged?page=${page}&size=${size}`);
  }

  function getFilteredLogs({ page = 1, size = 10, userId = null, startDate = null, endDate = null }) {
    const params = new URLSearchParams({ page, size });
    if (userId) params.append("userId", userId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return request(`/activitylog/filter?${params.toString()}`);
  }

  const fetchListActivity = async (pageParam = page, size = pageSize) => {
    // Kiểm tra ngày hợp lệ
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc!");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = selectedUser || startDate || endDate
        ? await getFilteredLogs({
          page: pageParam,
          size,
          userId: selectedUser?.id ?? null,
          startDate,
          endDate
        })
        : await getPagedLogs(pageParam, size);

      setListActivityLog(data?.data || []);
      setTotalPages(Math.max(1, Math.ceil((data?.total || 0) / size)));
      setPage(data?.page || pageParam);
    } catch (err) {
      // Show the failure instead of an empty list that looks like "no activity".
      setListActivityLog([]);
      setError(err.message || "Không tải được nhật ký hệ thống.");
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
    error,
    fetchListActivity,
    listuser,
    setListUsers,
    fetchAllUsers,
    handleSelectActivityLog

  };
};
