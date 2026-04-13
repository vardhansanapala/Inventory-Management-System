import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { getDeviceById } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { extractAssetId } from "../utils/scan";

export function ScanPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const scannerRef = useRef(null);
  const scannerActiveRef = useRef(false);
  const scannerId = "qr-reader";
  const [manualId, setManualId] = useState(id || "");
  const [scanError, setScanError] = useState("");
  const [asset, setAsset] = useState(null);
  const [assetError, setAssetError] = useState("");
  const [loadingAsset, setLoadingAsset] = useState(false);

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  }

  useEffect(() => {
    setManualId(id || "");
  }, [id]);

  useEffect(() => {
    scannerActiveRef.current = false;
    setScanError("");

    if (id) {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (scannerActiveRef.current) {
            return;
          }

          const assetId = extractAssetId(decodedText);
          if (assetId) {
            scannerActiveRef.current = true;
            scanner.stop().catch(() => {});
            navigate(`/scan/${assetId}`);
          }
        },
        () => {}
      )
      .catch(() => {
        if (isMounted) {
          setScanError("Camera access unavailable. Use manual input.");
        }
      });

    return () => {
      isMounted = false;
      scannerActiveRef.current = false;
      stopScanner();
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!id) {
      setAsset(null);
      setAssetError("");
      return;
    }

    setLoadingAsset(true);
    setAssetError("");
    getDeviceById(id)
      .then((data) => setAsset(data))
      .catch((err) => {
        setAsset(null);
        setAssetError(err.message || "Device not found.");
      })
      .finally(() => setLoadingAsset(false));
  }, [id]);

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const assetId = extractAssetId(manualId);
    if (!assetId) {
      setScanError("Enter a valid asset ID or scan URL.");
      return;
    }

    setScanError("");
    navigate(`/scan/${assetId}`);
  };

  return (
    <div className="page-stack">
      <SectionCard title="Scan Device" subtitle="Use camera scan or manual asset ID input">
        {scanError ? <div className="page-message error">{scanError}</div> : null}
        {!id ? <div id={scannerId} className="scan-reader" /> : null}
        <form className="inline-form" onSubmit={handleManualSubmit}>
          <input
            className="input"
            placeholder="Enter asset ID or full scan URL"
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
          />
          <button className="button dark" type="submit">
            Open
          </button>
        </form>
      </SectionCard>

      {id ? (
        <SectionCard title="Scanned Device Details" subtitle={`Asset ID: ${id}`}>
          {loadingAsset ? (
            <div className="page-message">Loading device...</div>
          ) : asset ? (
            <div className="device-summary-grid">
              <div className="detail-item">
                <span>Asset Code</span>
                <strong>{asset.assetCode}</strong>
              </div>
              <div className="detail-item">
                <span>Status</span>
                <StatusPill status={asset.status} />
              </div>
              <div className="detail-item">
                <span>SKU</span>
                <strong>{asset.product?.sku || "-"}</strong>
              </div>
              <div className="detail-item">
                <span>Location</span>
                <strong>{asset.location?.name || "-"}</strong>
              </div>
              <div className="detail-item">
                <span>Assigned To</span>
                <strong>
                  {asset.assignedTo
                    ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`
                    : "Unassigned"}
                </strong>
              </div>
            </div>
          ) : (
            <div className="page-message error">{assetError || "Device not found."}</div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
