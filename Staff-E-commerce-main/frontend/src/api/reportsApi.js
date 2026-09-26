const BASE_URL = "http://localhost:5099/api";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${errText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

/**
 * Export báo cáo bán hàng
 * @param {Date} fromDate - Ngày bắt đầu
 * @param {Date} toDate - Ngày kết thúc
 * @param {string} format - 'csv' hoặc 'xlsx'
 */
export async function exportSalesReport(fromDate, toDate, format = "csv") {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  params.append("format", format);

  const response = await fetch(`${BASE_URL}/reports/sales?${params}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Không thể xuất báo cáo bán hàng");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bao_cao_ban_hang_${new Date().toISOString().split("T")[0]}.${format === "xlsx" ? "xlsx" : "csv"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Export báo cáo tồn kho
 * @param {string} format - 'csv' hoặc 'xlsx'
 */
export async function exportInventoryReport(format = "csv") {
  const params = new URLSearchParams();
  params.append("format", format);

  const response = await fetch(`${BASE_URL}/reports/inventory?${params}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Không thể xuất báo cáo tồn kho");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bao_cao_ton_kho_${new Date().toISOString().split("T")[0]}.${format === "xlsx" ? "xlsx" : "csv"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Lấy tổng hợp báo cáo bán hàng
 */
export async function getSalesSummary(fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  return request(`/reports/summary?${params}`);
}

/**
 * Lấy doanh thu theo ngày
 */
export async function getRevenueByDay(fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  return request(`/reports/revenue-by-day?${params}`);
}

/**
 * Lấy tồn kho giá trị cao
 */
export async function getHighValueInventory(limit = 10) {
  return request(`/reports/high-value-inventory?limit=${limit}`);
}

/**
 * So sánh kỳ hiện tại với kỳ trước
 */
export async function getPeriodComparison(fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  return request(`/reports/period-comparison?${params}`);
}

/**
 * Lấy top sản phẩm bán chạy
 */
export async function getTopProducts(fromDate, toDate, limit = 10) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  params.append("limit", limit);
  return request(`/reports/top-products?${params}`);
}

/**
 * Lấy top khách hàng
 */
export async function getTopCustomers(fromDate, toDate, limit = 10) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  params.append("limit", limit);
  return request(`/reports/top-customers?${params}`);
}

/**
 * Lấy doanh số theo nhân viên
 */
export async function getSalesByStaff(fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.append("from", fromDate.toISOString().split("T")[0]);
  }
  if (toDate) {
    params.append("to", toDate.toISOString().split("T")[0]);
  }
  return request(`/reports/sales-by-staff?${params}`);
}

