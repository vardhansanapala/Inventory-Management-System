const DEFAULT_SCAN_BASE_URL = "http://localhost:5173/scan";
const SCAN_BASE_URL = (import.meta.env.VITE_SCAN_BASE_URL || DEFAULT_SCAN_BASE_URL).replace(/\/+$/, "");

export function buildScanUrl(assetId) {
  const normalizedAssetId = String(assetId || "").trim().toUpperCase();
  return normalizedAssetId ? `${SCAN_BASE_URL}/${encodeURIComponent(normalizedAssetId)}` : "";
}
