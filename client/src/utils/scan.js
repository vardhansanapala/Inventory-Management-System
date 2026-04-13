const DEFAULT_SCAN_BASE_URL = "http://localhost:5173/scan";
const SCAN_BASE_URL = (import.meta.env.VITE_SCAN_BASE_URL || DEFAULT_SCAN_BASE_URL).replace(/\/+$/, "");

export function buildScanUrl(assetCode) {
  const normalizedAssetCode = String(assetCode || "").trim().toUpperCase();
  return normalizedAssetCode ? `${SCAN_BASE_URL}/${encodeURIComponent(normalizedAssetCode)}` : "";
}

export function extractAssetId(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === "scan");

    if (scanIndex >= 0 && parts[scanIndex + 1]) {
      return decodeURIComponent(parts[scanIndex + 1]);
    }
  } catch {
    // Treat non-URL input as a raw asset identifier or scan path.
  }

  const pathMatch = text.match(/(?:^|\/)scan\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]).trim().toUpperCase();
  }

  return text.toUpperCase();
}
