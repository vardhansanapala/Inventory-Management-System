export function getAssetId(asset) {
  return String(asset?.assetId || asset?.assetCode || "")
    .trim()
    .toUpperCase();
}

export function isWfhLocation(asset) {
  return String(asset?.locationType || asset?.asset?.locationType || asset?.metadata?.locationType || "")
    .trim()
    .toUpperCase() === "WFH";
}

export function getAssetLocationLabel(asset) {
  if (isWfhLocation(asset)) {
    return "WFH";
  }

  return asset?.location?.name || "-";
}

export function getAssetWfhAddress(asset) {
  return String(asset?.wfhAddress || asset?.asset?.wfhAddress || asset?.metadata?.wfhAddress || "").trim();
}

export function getAssetScanUrl(asset) {
  const existing = String(asset?.qrCode || asset?.qrDeepLink || "").trim();
  if (existing) return existing;

  const assetId = getAssetId(asset);
  if (!assetId || typeof window === "undefined") return "";
  return `${window.location.origin}/device-info?assetId=${encodeURIComponent(assetId)}`;
}
