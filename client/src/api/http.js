import { getAuthToken } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

class ApiRequestError extends Error {
  constructor({ message, status = 0, details = null, code = "REQUEST_FAILED" }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

function buildHeaders(options = {}) {
  const token = getAuthToken();

  return {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
}

async function parseErrorResponse(response) {
  const errorPayload = await response.json().catch(() => ({}));
  const details = errorPayload.details || null;
  const code = details?.code || errorPayload.code || "REQUEST_FAILED";
  const message = errorPayload.message || getFallbackMessage(response.status, code);

  return new ApiRequestError({
    message,
    status: response.status,
    details,
    code,
  });
}

function getFallbackMessage(status, code) {
  if (code === "APP_UNINITIALIZED") {
    return "Application setup is incomplete.";
  }

  if (status === 401) return "Invalid email or password";
  if (status === 403) return "You do not have permission to perform this action";
  if (status >= 500) return "Server unavailable. Please try again later.";
  return "Request failed";
}

async function fetchWithApiErrors(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: buildHeaders(options),
      ...options,
    });
  } catch (error) {
    throw new ApiRequestError({
      message: "Server unavailable. Check your connection and try again.",
      status: 0,
      code: "SERVER_UNAVAILABLE",
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return response;
}

async function request(path, options = {}) {
  const response = await fetchWithApiErrors(path, options);
  return response.json();
}

async function requestBlob(path, options = {}) {
  const response = await fetchWithApiErrors(path, options);
  return response.blob();
}

export { API_BASE_URL, ApiRequestError, request, requestBlob };
