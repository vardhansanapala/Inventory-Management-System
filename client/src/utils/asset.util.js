export function getAssetId(asset) {
  return String(asset?.assetId || asset?.assetCode || "")
    .trim()
    .toUpperCase();
}

export function getAssetScanUrl(asset) {
  const existing = String(asset?.qrCode || asset?.qrDeepLink || "").trim();
  if (existing) return existing;

  const assetId = getAssetId(asset);
  if (!assetId || typeof window === "undefined") return "";
  return `${window.location.origin}/device-info?assetId=${encodeURIComponent(assetId)}`;
}
