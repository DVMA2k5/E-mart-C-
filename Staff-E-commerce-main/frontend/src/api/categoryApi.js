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

// Lấy danh sách categories với phân trang
export async function getCategories(
  page = 1,
  pageSize = 5,
  search = "",
  status = "all"
) {
  const params = new URLSearchParams({
    page,
    pageSize,
    keyword: search,
    status: status === "all" ? "" : status,
  });
  return request(`/categories?${params}`);
}

// Lấy chi tiết category
export async function getCategoryById(categoryId) {
  return request(`/categories/${categoryId}`);
}

// Tạo category mới
export async function createCategory(categoryData) {
  return request("/categories", {
    method: "POST",
    body: JSON.stringify(categoryData),
  });
}

// Cập nhật thông tin category
export async function updateCategory(categoryId, categoryData) {
  return request(`/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(categoryData),
  });
}

// Kích hoạt/Ngừng hoạt động category
export async function toggleCategoryStatus(categoryId, isActive) {
  return request(`/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify({ IsActive: isActive }),
  });
}

// Xóa category
export async function deleteCategory(categoryId) {
  return request(`/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// Lấy tất cả categories (không phân trang)
export async function getAllCategories() {
  return request("/categories/all");
}

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  getAllCategories,
};
