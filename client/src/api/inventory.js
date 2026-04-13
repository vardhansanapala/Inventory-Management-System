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

export function getSetupBootstrap() {
  return request("/setup/bootstrap");
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

export function createProduct(payload) {
  return request("/setup/products", {
    method: "POST",
    body: JSON.stringify(payload),
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
    method: "POST",
    body: JSON.stringify(payload),
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

export function createAsset(payload) {
  return request("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssetById(assetId) {
  return request(`/assets/${assetId}`);
}

export function getDeviceById(assetId) {
  return request(`/devices/${assetId}`);
}

export function getAssetAuditLogs(assetId) {
  return request(`/assets/${assetId}/audit-logs`);
}

export function performAssetAction(assetId, payload) {
  return request(`/assets/${assetId}/action`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadAssetCsv({ file, performedById }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("performedById", performedById);

  return request("/imports/assets", {
    method: "POST",
    body: formData,
  });
}

export async function getAssetQrBlobUrl(assetCode) {
  const normalizedAssetCode = String(assetCode || "").trim().toUpperCase();

  if (!normalizedAssetCode) {
    return "";
  }

  const blob = await requestBlob(`/assets/qr/${encodeURIComponent(normalizedAssetCode)}`);
  return URL.createObjectURL(blob);
}
