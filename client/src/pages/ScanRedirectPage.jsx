import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAssetById, listAssets } from "../api/inventory";
import { extractAssetId } from "../utils/qrParser.util";

function normalizeValue(value) {
  return String(value || "").trim().toUpperCase();
}

export function ScanRedirectPage() {
  const { qrCode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function resolveScan() {
      const decodedQrCode = String(qrCode || "").trim();
      const assetIdentifier = extractAssetId(decodedQrCode);

      if (!assetIdentifier) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const asset = await getAssetById(assetIdentifier);
        const resolvedAssetId = asset?.assetId || asset?._id;

        if (!cancelled && resolvedAssetId) {
          navigate(`/device-info?assetId=${encodeURIComponent(resolvedAssetId)}`, { replace: true });
          return;
        }
      } catch {
        // Fall back to the existing searchable asset list for SKU-based scans.
      }

      try {
        const assets = await listAssets({ search: assetIdentifier });
        const normalizedIdentifier = normalizeValue(assetIdentifier);
        const matchedAsset = Array.isArray(assets)
          ? assets.find((asset) => {
              const assetId = normalizeValue(asset?.assetId);
              const sku = normalizeValue(asset?.product?.sku);
              return assetId === normalizedIdentifier || sku === normalizedIdentifier;
            })
          : null;
        const resolvedAssetId = matchedAsset?.assetId || matchedAsset?._id;

        if (!cancelled && resolvedAssetId) {
          navigate(`/device-info?assetId=${encodeURIComponent(resolvedAssetId)}`, { replace: true });
          return;
        }
      } catch {
        // Fall through to the dashboard when no matching asset can be resolved.
      }

      if (!cancelled) {
        navigate("/", { replace: true });
      }
    }

    resolveScan();

    return () => {
      cancelled = true;
    };
  }, [navigate, qrCode]);

  return <div className="page-message">Resolving scanned device...</div>;
}
