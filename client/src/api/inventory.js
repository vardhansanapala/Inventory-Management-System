import { request, requestBlob } from "./http";

export function login(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return request("/auth/me");
}

export function getDashboardSummary() {
  return request("/dashboard/summary");
}

export function listLogs(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  return request(`/logs${query.toString() ? `?${query.toString()}` : ""}`);
}

export function getSetupBootstrap() {
  return request("/setup/bootstrap");
}

export function getAssetsBootstrap() {
  return request("/assets/bootstrap");
}

export function createCategory(payload) {
  return request("/setup/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createLocation(payload) {
  return request("/setup/locations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCategory(categoryId, payload) {
  return request(`/setup/categories/${encodeURIComponent(categoryId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCategory(categoryId) {
  return request(`/setup/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
}

export function updateLocation(locationId, payload) {
  return request(`/setup/locations/${encodeURIComponent(locationId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteLocation(locationId) {
  return request(`/setup/locations/${encodeURIComponent(locationId)}`, {
    method: "DELETE",
  });
}

export function createProduct(payload) {
  return request("/setup/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(productId, payload) {
  return request(`/setup/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(productId) {
  return request(`/setup/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

export function listUsers() {
  return request("/users");
}

export function createUser(payload) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(userId, payload) {
  return request(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resetUserPassword(userId, payload) {
  return request(`/users/${userId}/reset-password`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function pauseUser(userId) {
  return request(`/users/${userId}/pause`, {
    method: "PATCH",
  });
}

export function resumeUser(userId) {
  return request(`/users/${userId}/resume`, {
    method: "PATCH",
  });
}

export function deleteUser(userId) {
  return request(`/users/${userId}`, {
    method: "DELETE",
  });
}

export function listAssets(searchParams = {}) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return request(`/assets${query ? `?${query}` : ""}`);
}

export function getMyAssets(searchParams = {}) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return request(`/assets/my-assets${query ? `?${query}` : ""}`);
}

export function getAssetsByUser(userId) {
  return request(`/assets/by-user/${encodeURIComponent(userId)}`);
}

// Device Info list: all assets for SUPER_ADMIN, only assigned assets for everyone else
export function getAssets({ page = 1, limit = 10, search = "" } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (search) params.set("search", search);
  return request(`/assets?${params.toString()}`);
}

// Device Info details: backend enforces role-aware ownership checks
export function getAssetDetails(assetId) {
  return request(`/assets/${encodeURIComponent(assetId)}/details`);
}

export function createAsset(payload) {
  return request("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAsset(assetId, payload) {
  return request(`/assets/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAsset(assetId) {
  return request(`/assets/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
  });
}

export function getAssetById(assetId) {
  return request(`/assets/${encodeURIComponent(assetId)}`);
}

export function regenerateAssetQr(assetId) {
  return request(`/assets/${encodeURIComponent(assetId)}/regenerate-qr`, {
    method: "POST",
  });
}

export function getDeviceById(assetId) {
  return request(`/devices/${encodeURIComponent(assetId)}`);
}

export function getAssetAuditLogs(assetId) {
  return request(`/assets/${encodeURIComponent(assetId)}/audit-logs`);
}

export function performAssetAction(assetId, payload) {
  return request(`/assets/${encodeURIComponent(assetId)}/action`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadAssetCsv({ file, performedById }) {
  const formData = new FormData();
  formData.append("file", file);
  if (performedById) {
    formData.append("performedById", performedById);
  }

  return request("/imports/assets", {
    method: "POST",
    body: formData,
  });
}

export async function getAssetQrBlobUrl(assetId) {
  const normalizedAssetId = String(assetId || "").trim().toUpperCase();

  if (!normalizedAssetId) {
    return "";
  }

  const blob = await requestBlob(`/assets/qr/${encodeURIComponent(normalizedAssetId)}`);
  return URL.createObjectURL(blob);
}
