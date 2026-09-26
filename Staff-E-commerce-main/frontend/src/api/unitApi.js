import { request } from "./apiClient";

export async function getAllUnits(isActive = null) {
  const params = new URLSearchParams();
  if (isActive !== null) params.append("isActive", isActive);

  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/units${query}`);
}

export async function getUnitById(id) {
  return request(`/units/${id}`);
}

export async function createUnit(data) {
  return request("/units", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUnit(id, data) {
  return request(`/units/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteUnit(id) {
  return request(`/units/${id}`, {
    method: "DELETE",
  });
}

export async function toggleUnitActive(id) {
  return request(`/units/${id}/toggle-active`, {
    method: "PATCH",
  });
}
