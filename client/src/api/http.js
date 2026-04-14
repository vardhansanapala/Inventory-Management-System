import { getAuthToken } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function buildHeaders(options = {}) {
  const token = getAuthToken();

  return {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(options),
    ...options,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorPayload.message || "Request failed");
  }

  return response.json();
}

async function requestBlob(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildHeaders(options),
    ...options,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorPayload.message || "Request failed");
  }

  return response.blob();
}

export { API_BASE_URL, request, requestBlob };
