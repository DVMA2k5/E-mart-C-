import { request } from "./apiClient";

// Lấy danh sách inventory với phân trang
export async function getInventoryPaginated(
  page = 1,
  pageSize = 10,
  search = "",
  sortBy = "",
  stockStatus = ""
) {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    ...(search && { search }),
    ...(sortBy && { sortBy }),
    ...(stockStatus && { stockStatus }),
  });
  return request(`/inventory/paginated?${params}`);
}

// Điều chỉnh số lượng tồn kho
export async function adjustInventory(inventoryId, newQuantity, reason = "") {
  return request("/inventory/adjust", {
    method: "PUT",
    body: JSON.stringify({
      inventoryId,
      newQuantity,
      reason,
    }),
  });
}

// Lấy thống kê tồn kho
export async function getInventoryStats() {
  return request("/inventory/stats");
}

export default {
  getInventoryPaginated,
  adjustInventory,
  getInventoryStats,
};

