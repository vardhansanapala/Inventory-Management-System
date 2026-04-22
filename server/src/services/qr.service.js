const QRCode = require("qrcode");
const env = require("../config/env");

function normalizeAssetId(assetId) {
  return String(assetId || "").trim().toUpperCase();
}

async function generateQrPngBuffer(text) {
  return QRCode.toBuffer(text, {
    type: "png",
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function buildAssetQrValue(assetId) {
  return buildAssetScanUrl(assetId);
}

function buildAssetScanUrl(assetId) {
  const baseUrl = String(env.qrDeepLinkBaseUrl || "http://localhost:5173/device-info?assetId=").trim();
  const normalizedAssetId = normalizeAssetId(assetId);
  if (!normalizedAssetId) return "";
  if (baseUrl.includes("?assetId=")) {
    return `${baseUrl}${encodeURIComponent(normalizedAssetId)}`;
  }
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(normalizedAssetId)}`;
}

module.exports = {
  normalizeAssetId,
  buildAssetQrValue,
  buildAssetScanUrl,
  generateQrPngBuffer,
};
