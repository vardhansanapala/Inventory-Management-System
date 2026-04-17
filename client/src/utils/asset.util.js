export function getAssetId(asset) {
  return String(asset?.assetId || asset?.assetCode || "")
    .trim()
    .toUpperCase();
}

export function getAssetScanUrl(asset) {
  return String(asset?.qrCode || asset?.qrDeepLink || "").trim();
}
