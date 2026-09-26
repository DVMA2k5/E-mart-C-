import { request } from "./apiClient";

export async function getAllSuppliers(isActive = null) {
  const params = new URLSearchParams();
  if (isActive !== null) params.append("isActive", isActive);

  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/suppliers${query}`);
}

export async function getSupplierById(id) {
  return request(`/suppliers/${id}`);
}

export async function createSupplier(data) {
  return request("/suppliers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSupplier(id, data) {
  return request(`/suppliers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSupplier(id) {
  return request(`/suppliers/${id}`, {
    method: "DELETE",
  });
}

export async function toggleSupplierActive(id) {
  return request(`/suppliers/${id}/toggle-active`, {
    method: "PATCH",
  });
}
