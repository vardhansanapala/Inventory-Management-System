const QRCode = require("qrcode");
const env = require("../config/env");

async function generateQrPngBuffer(text) {
  return QRCode.toBuffer(text, {
    type: "png",
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function buildAssetQrValue(assetCode) {
  return String(assetCode || "").trim().toUpperCase();
}

function buildAssetScanUrl(assetCode) {
  const baseUrl = String(env.qrDeepLinkBaseUrl || "http://localhost:5173/scan").replace(/\/+$/, "");
  return `${baseUrl}/${encodeURIComponent(buildAssetQrValue(assetCode))}`;
}

module.exports = {
  buildAssetQrValue,
  buildAssetScanUrl,
  generateQrPngBuffer,
};
