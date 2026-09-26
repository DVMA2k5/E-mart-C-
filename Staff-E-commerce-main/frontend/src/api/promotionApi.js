import { request } from './apiClient';

export async function getAllPromotions() {
  return request("/promotions");
}

export async function getPromotionsPaginated(page = 1, pageSize = 12, search = '', status = 'all', type = 'all') {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  if (type && type !== 'all') params.append('type', type);
  return request(`/promotions/paginated?${params.toString()}`);
}

export async function getPromotionById(id) {
  return request(`/promotions/${id}`);
}

export async function getPromotionByCode(code) {
  return request(`/promotions/code/${encodeURIComponent(code)}`);
}

export async function createPromotion(data) {
  return request("/promotions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePromotion(id, data) {
  return request(`/promotions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePromotion(id) {
  return request(`/promotions/${id}`, {
    method: "DELETE",
  });
}

export async function togglePromotionActive(id) {
  return request(`/promotions/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function validatePromotion(code, orderAmount) {
  return request("/promotions/validate", {
    method: "POST",
    body: JSON.stringify({ code, orderAmount }),
  });
}

export async function getActivePromotions() {
  return request("/promotions/active");
}

export async function getPromotionOverviewStats() {
  return request("/promotions/overview-stats");
}

export async function getPromotionRedemptions(id) {
  return request(`/promotions/${id}/redemptions`);
}

export async function getPromotionStats(id) {
  return request(`/promotions/${id}/stats`);
}
