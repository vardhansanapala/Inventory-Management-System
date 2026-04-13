import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { getAssetById } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { getAssetId, getAssetScanUrl } from "../utils/asset.util";
import { extractAssetId } from "../utils/qrParser.util";

export function ScanPage() {
  const navigate = useNavigate();
  const { assetId } = useParams();
  const scannerRef = useRef(null);
  const scannerActiveRef = useRef(false);
  const scannerId = "qr-reader";
  const [manualId, setManualId] = useState(assetId || "");
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

  function toScanErrorMessage(error) {
    const rawMessage = String(error?.message || error || "").toLowerCase();

    if (!window.isSecureContext) {
      return "Camera needs a secure context (HTTPS or localhost). Open this app on localhost/HTTPS.";
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return "Camera API is unavailable in this browser. Try Chrome/Edge on desktop or mobile.";
    }

    if (rawMessage.includes("notallowederror") || rawMessage.includes("permission denied")) {
      return "Camera permission denied. Allow camera access in browser site permissions and retry.";
    }

    if (rawMessage.includes("notfounderror") || rawMessage.includes("requested device not found")) {
      return "No camera device found. Connect a camera or use manual asset ID input.";
    }

    if (rawMessage.includes("notreadableerror") || rawMessage.includes("trackstarterror")) {
      return "Camera is busy in another app/tab. Close other camera apps and retry.";
    }

    return "Camera access unavailable. Use manual input.";
  }

  useEffect(() => {
    setManualId(assetId || "");
  }, [assetId]);

  useEffect(() => {
    scannerActiveRef.current = false;
    setScanError("");

    if (assetId) {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    async function startScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("MediaDevices unavailable");
        }

        // Prompt camera permissions early so we can show accurate error states.
        const warmupStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        warmupStream.getTracks().forEach((track) => track.stop());

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (scannerActiveRef.current) {
              return;
            }

            const scannedAssetId = extractAssetId(decodedText);
            if (scannedAssetId) {
              scannerActiveRef.current = true;
              scanner.stop().catch(() => {});
              navigate(`/scan/${scannedAssetId}`);
            }
          },
          () => {}
        );
      } catch (error) {
        if (isMounted) {
          setScanError(toScanErrorMessage(error));
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      scannerActiveRef.current = false;
      stopScanner();
    };
  }, [assetId, navigate]);

  useEffect(() => {
    if (!assetId) {
      setAsset(null);
      setAssetError("");
      return;
    }

    setLoadingAsset(true);
    setAssetError("");
    getAssetById(assetId)
      .then((data) => setAsset(data))
      .catch((err) => {
        setAsset(null);
        setAssetError(err.message || "Device not found.");
      })
      .finally(() => setLoadingAsset(false));
  }, [assetId]);

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const nextAssetId = extractAssetId(manualId);
    if (!nextAssetId) {
      setScanError("Enter a valid asset ID or scan URL.");
      return;
    }

    setScanError("");
    navigate(`/scan/${nextAssetId}`);
  };

  return (
    <div className="page-stack">
      <SectionCard title="Scan Device" subtitle="Use camera scan or manual asset ID input">
        {scanError ? <div className="page-message error">{scanError}</div> : null}
        {!assetId ? <div id={scannerId} className="scan-reader" /> : null}
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

      {assetId ? (
        <SectionCard title="Scanned Device Details" subtitle={`Asset ID: ${assetId}`}>
          {loadingAsset ? (
            <div className="page-message">Loading device...</div>
          ) : asset ? (
            <div className="device-summary-grid">
              <div className="detail-item">
                <span>Asset ID</span>
                <strong>{getAssetId(asset)}</strong>
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
              <div className="detail-item">
                <span>Scan URL</span>
                <strong>{getAssetScanUrl(asset)}</strong>
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
