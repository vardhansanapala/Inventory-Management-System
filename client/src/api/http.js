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
    // #region agent log
    fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H3", location: "http.js:25", message: "api response not ok", data: { path, status: response.status, hasAuthToken: Boolean(getAuthToken()), serverMessage: errorPayload.message || "Request failed" }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
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
