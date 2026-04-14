import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  createAsset,
  getAssetsBootstrap,
  getAssetAuditLogs,
  getAssetById,
  getAssetQrBlobUrl,
  listAssets,
  performAssetAction,
  regenerateAssetQr,
  uploadAssetCsv,
} from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import {
  ASSET_ACTIONS,
  ASSET_STATUSES,
  getReasonOptions,
  getValidActionsForStatus,
} from "../constants/assetWorkflow";
import { getAssetId, getAssetScanUrl } from "../utils/asset.util";
import { extractAssetId } from "../utils/qrParser.util";
const sectionTabs = [
  { id: "registry", title: "Device Registry", subtitle: "Browse and select devices" },
  { id: "add", title: "Add Device", subtitle: "Create and preview QR inline" },
  { id: "assign", title: "Assign Device", subtitle: "Scan or enter an asset ID" },
];
const validSectionTabs = new Set(sectionTabs.map((tab) => tab.id));

function normalizeTab(tabValue) {
  return validSectionTabs.has(tabValue) ? tabValue : "registry";
}

function AssetReference({ assetId, copied, onCopy }) {
  return (
    <div className="asset-reference">
      <span>Asset ID</span>
      <div className="asset-reference-row">
        <code>{assetId || "-"}</code>
        <button className="button ghost" type="button" onClick={onCopy} disabled={!assetId}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function QrPreviewPanel({
  asset,
  qrImageUrl,
  qrLoading,
  qrError,
  copiedAssetId,
  onCopyAssetId,
  onRegenerateQr,
  regeneratingQr = false,
}) {
  const assetId = getAssetId(asset);
  const scanUrl = getAssetScanUrl(asset);

  if (!asset) {
    return <div className="empty-state">Create or select a device to load its QR preview and copyable asset ID.</div>;
  }

  return (
    <div className="qr-panel qr-panel-inline">
      <div className="qr-panel-header">
        <div>
          <p className="qr-title">Generated QR</p>
          <strong>{assetId}</strong>
        </div>
        <div className="registry-actions">
          {onRegenerateQr ? (
            <button className="button ghost" type="button" onClick={onRegenerateQr} disabled={regeneratingQr}>
              {regeneratingQr ? "Regenerating..." : "Regenerate QR"}
            </button>
          ) : null}
          <StatusPill status={asset.status} />
        </div>
      </div>

      {qrLoading ? <div className="page-message">Fetching QR with your authenticated session...</div> : null}
      {qrError ? <div className="page-message error">{qrError}</div> : null}
      {qrImageUrl ? <img className="qr-preview" src={qrImageUrl} alt={`QR for ${assetId}`} /> : <div className="qr-placeholder">QR preview will appear here as soon as it is available.</div>}
      {qrImageUrl ? (
        <a className="button ghost" href={qrImageUrl} download={`${assetId}-qr.png`}>
          Download QR
        </a>
      ) : null}

      <AssetReference assetId={assetId} copied={copiedAssetId} onCopy={onCopyAssetId} />

      <div className="detail-item">
        <span>Scan URL</span>
        <strong className="scan-link-label">{scanUrl}</strong>
      </div>
    </div>
  );
}

function getCameraErrorMessage(error) {
  const name = String(error?.name || "");
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was denied. Manual Asset ID entry has been enabled.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found on this device. Manual Asset ID entry has been enabled.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is already in use or unavailable right now. Manual Asset ID entry has been enabled.";
  if (name === "OverconstrainedError") return "This camera does not support the requested settings. Manual Asset ID entry has been enabled.";
  return error?.message || "Unable to start the camera. Manual Asset ID entry has been enabled.";
}

const emptySetupData = {
  products: [],
  locations: [],
  users: [],
};

export function AssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupData, setSetupData] = useState(emptySetupData);
  const [setupLoading, setSetupLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => normalizeTab(searchParams.get("tab")));
  const [assets, setAssets] = useState([]);
  const [assetLogs, setAssetLogs] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [search, setSearch] = useState("");
  const [quickAccessId, setQuickAccessId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [latestCreatedAsset, setLatestCreatedAsset] = useState(null);
  const [selectedAssetQrUrl, setSelectedAssetQrUrl] = useState("");
  const [selectedAssetQrLoading, setSelectedAssetQrLoading] = useState(false);
  const [selectedAssetQrError, setSelectedAssetQrError] = useState("");
  const [selectedAssetQrRegenerating, setSelectedAssetQrRegenerating] = useState(false);
  const [createdAssetQrUrl, setCreatedAssetQrUrl] = useState("");
  const [createdAssetQrLoading, setCreatedAssetQrLoading] = useState(false);
  const [createdAssetQrError, setCreatedAssetQrError] = useState("");
  const [createdAssetQrRegenerating, setCreatedAssetQrRegenerating] = useState(false);
  const [copiedAssetId, setCopiedAssetId] = useState("");
  const [assignMode, setAssignMode] = useState("scan");
  const [assignLookupInput, setAssignLookupInput] = useState("");
  const [assignLookupBusy, setAssignLookupBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanStatus, setScanStatus] = useState("idle");
  const [scanEngine, setScanEngine] = useState("native");
  const [lastDecodedValue, setLastDecodedValue] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const html5ScannerRef = useRef(null);
  const assignInputRef = useRef(null);
  const streamRef = useRef(null);
  const frameRequestRef = useRef(null);
  const detectorRef = useRef(null);
  const scanHandledRef = useRef(false);
  const copyTimeoutRef = useRef(null);
  const [createForm, setCreateForm] = useState({ productId: "", serialNumber: "", locationId: "", assignedToId: "", notes: "" });
  const [actionForm, setActionForm] = useState({
    action: ASSET_ACTIONS.ASSIGN_DEVICE,
    reason: "OTHER",
    customReason: "",
    locationId: "",
    assignedToId: "",
    notes: "",
    issue: "",
    vendor: "",
    cost: "",
    externalRecipient: "",
  });
  const validActionOptions = getValidActionsForStatus(selectedAsset?.status);
  const reasonOptions = getReasonOptions(actionForm.action, selectedAsset?.status);
  const selectedAssetRequiresExternalRecipient =
    selectedAsset?.status === ASSET_STATUSES.AVAILABLE && actionForm.action === ASSET_ACTIONS.SEND_OUTSIDE;
  const selectedAssetRequiresAssignee = actionForm.action === ASSET_ACTIONS.ASSIGN_DEVICE;

  async function copyAssetId(assetId) {
    if (!assetId || !navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(assetId);
    setCopiedAssetId(assetId);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopiedAssetId(""), 1800);
  }

  function updateActiveTab(nextTab) {
    const normalizedTab = normalizeTab(nextTab);
    setActiveTab(normalizedTab);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("tab", normalizedTab);
      return nextParams;
    }, { replace: true });
  }

  function loadAssets(filters = {}) {
    return listAssets(filters)
      .then((data) => {
        setAssets(data);
        if (selectedAssetId && !data.some((asset) => asset._id === selectedAssetId)) {
          setSelectedAssetId("");
          setSelectedAsset(null);
          setAssetLogs([]);
        }
      })
      .catch((err) => setError(err.message));
  }

  async function loadSetupData() {
    try {
      setSetupLoading(true);
      const data = await getAssetsBootstrap();
      setSetupData({
        products: Array.isArray(data?.products) ? data.products : [],
        locations: Array.isArray(data?.locations) ? data.locations : [],
        users: Array.isArray(data?.users) ? data.users : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSetupLoading(false);
    }
  }

  async function loadQrPreview(assetId, setters) {
    const { setLoading, setQrUrl, setQrError } = setters;

    if (!assetId) {
      setQrUrl("");
      setQrError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setQrError("");

    try {
      const qrUrl = await getAssetQrBlobUrl(assetId);
      setQrUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return qrUrl;
      });
    } catch (err) {
      setQrError(err.message || "Unable to load QR preview.");
      setQrUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return "";
      });
    } finally {
      setLoading(false);
    }
  }

  function getQrPreviewSetters(target) {
    return target === "selected"
      ? {
          setLoading: setSelectedAssetQrLoading,
          setQrUrl: setSelectedAssetQrUrl,
          setQrError: setSelectedAssetQrError,
        }
      : {
          setLoading: setCreatedAssetQrLoading,
          setQrUrl: setCreatedAssetQrUrl,
          setQrError: setCreatedAssetQrError,
        };
  }

  async function refreshQrPreview(target, assetId) {
    await loadQrPreview(assetId, getQrPreviewSetters(target));
  }

  async function applySelectedAsset(asset, selectionMessage) {
    const logs = await getAssetAuditLogs(asset._id);
    const assetId = getAssetId(asset);
    setSelectedAssetId(asset._id);
    setSelectedAsset(asset);
    setAssetLogs(logs);
    setAssignLookupInput(assetId);

    if (selectionMessage) {
      setMessage(selectionMessage);
    }
  }

  async function handleRegenerateQr(asset, target) {
    if (!asset?._id) {
      return;
    }

    const setRegenerating = target === "selected" ? setSelectedAssetQrRegenerating : setCreatedAssetQrRegenerating;
    setRegenerating(true);
    setError("");
    setMessage("");

    try {
      const refreshedAsset = await regenerateAssetQr(asset._id);

      const isSelectedAsset = selectedAssetId === refreshedAsset._id;
      const isLatestCreatedAsset = latestCreatedAsset?._id === refreshedAsset._id;

      if (target === "selected" || isSelectedAsset) {
        setSelectedAsset(refreshedAsset);
      }

      if (target === "created" || isLatestCreatedAsset) {
        setLatestCreatedAsset(refreshedAsset);
      }

      if (isSelectedAsset) {
        await refreshQrPreview("selected", getAssetId(refreshedAsset));
      }

      if (isLatestCreatedAsset) {
        await refreshQrPreview("created", getAssetId(refreshedAsset));
      } else {
        await refreshQrPreview(target, getAssetId(refreshedAsset));
      }
      setMessage(`QR regenerated for ${getAssetId(refreshedAsset)}.`);
    } catch (err) {
      setError(err.message || "Unable to regenerate the QR code.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSelectAsset(assetId) {
    setError("");

    try {
      const asset = await getAssetById(assetId);
      await applySelectedAsset(asset, `Selected ${getAssetId(asset)}. Actions now apply only to this device.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function lookupAndSelectAsset(rawInput, sourceLabel) {
    const assetIdentifier = extractAssetId(rawInput);
    if (!assetIdentifier) throw new Error("Enter a valid asset ID or scan URL.");

    const asset = await getAssetById(assetIdentifier);
    const resolvedAssetId = getAssetId(asset);
    const registrySearch = assets.some((item) => item._id === asset._id) ? search : resolvedAssetId;
    setAssignLookupInput(resolvedAssetId);
    setSearch(registrySearch);
    await loadAssets(registrySearch ? { search: registrySearch } : {});
    await applySelectedAsset(asset, `${resolvedAssetId} is now selected from ${sourceLabel}.`);
    return asset;
  }

  async function openQuickAccess(event) {
    event.preventDefault();
    if (!quickAccessId.trim()) return;

    setError("");
    setMessage("");

    try {
      await lookupAndSelectAsset(quickAccessId, "quick access");
      updateActiveTab("registry");
      setMessage("Quick access selected the device and focused the registry.");
    } catch (err) {
      setError(err.message || "Asset not found");
    }
  }

  function stopScanner() {
    scanHandledRef.current = false;
    setScanStatus("idle");

    if (frameRequestRef.current) {
      window.cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (html5ScannerRef.current) {
      html5ScannerRef.current.stop().catch(() => {});
      html5ScannerRef.current.clear().catch(() => {});
      html5ScannerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  function fallbackToManual(nextError) {
    stopScanner();
    setScanError(nextError);
    setAssignMode("manual");
    window.requestAnimationFrame(() => assignInputRef.current?.focus());
  }

  async function processScannedValue(decodedValue, sourceLabel) {
    const assetIdentifier = extractAssetId(decodedValue);
    setLastDecodedValue(decodedValue);
    setAssignLookupInput(assetIdentifier);
    setAssignLookupBusy(true);
    setError("");
    setMessage("");

    try {
      await lookupAndSelectAsset(assetIdentifier, sourceLabel);
    } catch (err) {
      setError(err.message || "Unable to select the scanned device.");
      fallbackToManual("The scanned value could not be matched to a device. Manual Asset ID entry has been enabled.");
      return;
    } finally {
      setAssignLookupBusy(false);
    }

    stopScanner();
  }

  async function detectQrCode() {
    if (!videoRef.current || !canvasRef.current || !detectorRef.current || scanHandledRef.current) return;

    const video = videoRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRequestRef.current = window.requestAnimationFrame(detectQrCode);
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      fallbackToManual("The browser could not process the camera feed. Manual Asset ID entry has been enabled.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const barcodes = await detectorRef.current.detect(canvas);
      if (Array.isArray(barcodes) && barcodes[0]?.rawValue) {
        scanHandledRef.current = true;
        setScanStatus("detected");
        await processScannedValue(barcodes[0].rawValue, "camera scan");
        return;
      }
    } catch (err) {
      fallbackToManual(getCameraErrorMessage(err));
      return;
    }

    frameRequestRef.current = window.requestAnimationFrame(detectQrCode);
  }

  async function startScanner() {
    updateActiveTab("assign");
    setAssignMode("scan");
    setError("");
    setMessage("");
    setScanError("");
    setScanStatus("requesting");
    setScanEngine("native");
    scanHandledRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackToManual("Camera access is not supported in this browser. Manual Asset ID entry has been enabled.");
      return;
    }

    try {
      if ("BarcodeDetector" in window) {
        const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
        if (supportedFormats.includes("qr_code")) {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          setScanEngine("native");
          setScanStatus("streaming");
          frameRequestRef.current = window.requestAnimationFrame(detectQrCode);
          return;
        }
      }

      const scanner = new Html5Qrcode("assign-qr-reader");
      html5ScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          setScanStatus("detected");
          await processScannedValue(decodedText, "camera scan");
        },
        () => {}
      );
      setScanEngine("html5");
      setScanStatus("streaming");
    } catch (err) {
      fallbackToManual(getCameraErrorMessage(err));
    }
  }

  useEffect(() => {
    loadSetupData();
    loadAssets();
  }, []);

  useEffect(() => {
    const nextTab = normalizeTab(searchParams.get("tab"));
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [searchParams]);

  useEffect(() => {
    loadQrPreview(getAssetId(selectedAsset), {
      setLoading: setSelectedAssetQrLoading,
      setQrUrl: setSelectedAssetQrUrl,
      setQrError: setSelectedAssetQrError,
    });
  }, [selectedAsset]);

  useEffect(() => {
    loadQrPreview(getAssetId(latestCreatedAsset), {
      setLoading: setCreatedAssetQrLoading,
      setQrUrl: setCreatedAssetQrUrl,
      setQrError: setCreatedAssetQrError,
    });
  }, [latestCreatedAsset]);

  useEffect(() => {
    if (activeTab !== "assign" || assignMode !== "scan") {
      stopScanner();
    }
  }, [activeTab, assignMode]);

  useEffect(() => {
    const nextValidActions = getValidActionsForStatus(selectedAsset?.status);

    setActionForm((current) => {
      const nextAction = nextValidActions.includes(current.action) ? current.action : nextValidActions[0] || "";
      const nextReasonOptions = getReasonOptions(nextAction, selectedAsset?.status);
      const nextReason = nextReasonOptions.includes(current.reason) ? current.reason : nextReasonOptions[0] || "OTHER";

      return {
        ...current,
        action: nextAction,
        reason: nextReason,
        assignedToId: nextAction === ASSET_ACTIONS.ASSIGN_DEVICE ? current.assignedToId : "",
        externalRecipient:
          selectedAsset?.status === ASSET_STATUSES.AVAILABLE && nextAction === ASSET_ACTIONS.SEND_OUTSIDE
            ? current.externalRecipient
            : "",
      };
    });
  }, [selectedAsset?.status]);

  useEffect(() => {
    return () => {
      stopScanner();
      if (selectedAssetQrUrl) URL.revokeObjectURL(selectedAssetQrUrl);
      if (createdAssetQrUrl) URL.revokeObjectURL(createdAssetQrUrl);
      window.clearTimeout(copyTimeoutRef.current);
    };
  }, [selectedAssetQrUrl, createdAssetQrUrl]);

  function handleCreateChange(event) {
    setCreateForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleActionChange(event) {
    const { name, value } = event.target;

    setActionForm((current) => {
      const nextForm = { ...current, [name]: value };

      if (name === "action") {
        const nextReasonOptions = getReasonOptions(value, selectedAsset?.status);
        nextForm.reason = nextReasonOptions.includes(current.reason) ? current.reason : nextReasonOptions[0] || "OTHER";

        if (value !== ASSET_ACTIONS.ASSIGN_DEVICE) {
          nextForm.assignedToId = "";
        }

        if (!(selectedAsset?.status === ASSET_STATUSES.AVAILABLE && value === ASSET_ACTIONS.SEND_OUTSIDE)) {
          nextForm.externalRecipient = "";
        }
      }

      return nextForm;
    });
  }

  async function submitAsset(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const createdAsset = await createAsset({ ...createForm, assignedToId: createForm.assignedToId || null });
      setLatestCreatedAsset(createdAsset);
      setMessage(`Asset ${getAssetId(createdAsset)} created. QR is shown below in this section.`);
      setCreateForm({ productId: "", serialNumber: "", locationId: "", assignedToId: "", notes: "" });
      await loadAssets(search ? { search } : {});
      await handleSelectAsset(createdAsset._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssignLookupSubmit(event) {
    event.preventDefault();
    setAssignLookupBusy(true);
    setError("");
    setMessage("");

    try {
      await lookupAndSelectAsset(assignLookupInput, "manual Asset ID entry");
    } catch (err) {
      setError(err.message || "Device not found.");
    } finally {
      setAssignLookupBusy(false);
    }
  }

  async function handleSimulateScan() {
    if (!assignLookupInput.trim()) {
      setScanError("Enter an Asset ID first to simulate a scan.");
      return;
    }

    setScanError("");
    await processScannedValue(assignLookupInput, "simulated scan");
  }

  async function submitAction(event) {
    event.preventDefault();

    if (!selectedAssetId) {
      setError("Select a device first. The action form only works on the selected device.");
      return;
    }

    if (!validActionOptions.includes(actionForm.action)) {
      setMessage("This device does not allow that action in its current status.");
      return;
    }

    if (selectedAssetRequiresAssignee && !actionForm.assignedToId) {
      setError("Select an assignee before assigning the device.");
      return;
    }

    if (selectedAssetRequiresExternalRecipient && !actionForm.externalRecipient.trim()) {
      setError("Enter an external recipient before sending an available device outside.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await performAssetAction(selectedAssetId, {
        ...actionForm,
        locationId: actionForm.locationId || null,
        assignedToId: selectedAssetRequiresAssignee ? actionForm.assignedToId || null : null,
        externalRecipient: selectedAssetRequiresExternalRecipient ? actionForm.externalRecipient.trim() : null,
        cost: actionForm.cost ? Number(actionForm.cost) : null,
      });

      setSelectedAsset(result.asset);
      setMessage(`Action ${actionForm.action} completed for ${getAssetId(result.asset)}.`);
      await loadAssets(search ? { search } : {});
      const logs = await getAssetAuditLogs(selectedAssetId);
      setAssetLogs(logs);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitCsv(event) {
    event.preventDefault();
    const file = event.target.file.files?.[0];

    if (!file) {
      setError("Select a CSV file first.");
      return;
    }

    try {
      const result = await uploadAssetCsv({ file });
      setMessage(`CSV queued successfully. Job ID: ${result.jobId}`);
      event.target.reset();
    } catch (err) {
      setError(err.message);
    }
  }

  if (setupLoading) {
    return <div className="page-message">Loading assets workspace...</div>;
  }

  return (
    <div className="page-stack">
      {message ? <div className="page-message success">{message}</div> : null}
      {error ? <div className="page-message error">{error}</div> : null}

      <div className="asset-tabs" role="tablist" aria-label="Device management sections">
        {sectionTabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button key={tab.id} type="button" className={isActive ? "section-tab is-active" : "section-tab"} onClick={() => updateActiveTab(tab.id)}>
              <span className="section-tab-label">{tab.title}</span>
              <span className="section-tab-copy">{tab.subtitle}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "registry" ? (
        <SectionCard
          title="Device Registry"
          subtitle="Search devices, then explicitly select one before running any action"
          actions={
            <div className="registry-actions">
              <form className="inline-form" onSubmit={openQuickAccess}>
                <input className="input" placeholder="Quick Access: asset ID or /scan/:assetId URL" value={quickAccessId} onChange={(event) => setQuickAccessId(event.target.value)} />
                <button className="button dark" type="submit">Open</button>
              </form>
              <form className="inline-form" onSubmit={(event) => { event.preventDefault(); loadAssets(search ? { search } : {}); }}>
                <input className="input" placeholder="Search by asset code, SKU, or serial" value={search} onChange={(event) => setSearch(event.target.value)} />
                <button className="button dark" type="submit">Search</button>
              </form>
            </div>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Assignee</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset._id} className={selectedAssetId === asset._id ? "selected-row" : ""} onClick={() => handleSelectAsset(asset._id)}>
                    <td>
                      <strong>{getAssetId(asset)}</strong>
                      <div className="table-subtle">{asset.serialNumber || "No serial number"}</div>
                    </td>
                    <td>{asset.product?.sku}</td>
                    <td><StatusPill status={asset.status} /></td>
                    <td>{asset.location?.name || "-"}</td>
                    <td>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}</td>
                    <td>
                      <button
                        className={selectedAssetId === asset._id ? "table-button active" : "table-button"}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectAsset(asset._id);
                        }}
                      >
                        {selectedAssetId === asset._id ? "Selected" : "Select Device"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "add" ? (
        <SectionCard title="Create Device" subtitle="Create a physical asset and immediately preview its QR in the same section">
          <div className="two-column-grid">
            <form className="form-grid" onSubmit={submitAsset}>
              <select className="input" name="productId" value={createForm.productId} onChange={handleCreateChange} required>
                <option value="">Select SKU</option>
                {setupData.products.map((product) => <option key={product._id} value={product._id}>{product.sku} - {product.brand} {product.model}</option>)}
              </select>
              <input className="input" name="serialNumber" placeholder="Serial Number" value={createForm.serialNumber} onChange={handleCreateChange} />
              <select className="input" name="locationId" value={createForm.locationId} onChange={handleCreateChange} required>
                <option value="">Initial Location</option>
                {setupData.locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}
              </select>
              <select className="input" name="assignedToId" value={createForm.assignedToId} onChange={handleCreateChange}>
                <option value="">Assigned To (optional)</option>
                {setupData.users.map((user) => <option key={user._id} value={user._id}>{user.firstName} {user.lastName}</option>)}
              </select>
              <textarea className="input textarea" name="notes" placeholder="Creation notes" value={createForm.notes} onChange={handleCreateChange} />
              <button className="button" type="submit">Create Device And Generate QR</button>
            </form>

            <QrPreviewPanel
              asset={latestCreatedAsset}
              qrImageUrl={createdAssetQrUrl}
              qrLoading={createdAssetQrLoading}
              qrError={createdAssetQrError}
              copiedAssetId={copiedAssetId === getAssetId(latestCreatedAsset)}
              onCopyAssetId={() => copyAssetId(getAssetId(latestCreatedAsset))}
              onRegenerateQr={() => handleRegenerateQr(latestCreatedAsset, "created")}
              regeneratingQr={createdAssetQrRegenerating}
            />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "assign" ? (
        <div className="two-column-grid">
          <SectionCard title="Selected Device" subtitle="This panel shows the exact device that actions will target">
            <div className="assign-selector">
              <div className="mode-toggle" role="tablist" aria-label="Device selection mode">
                <button type="button" className={assignMode === "scan" ? "button dark" : "button ghost"} onClick={startScanner}>Scan QR</button>
                <button
                  type="button"
                  className={assignMode === "manual" ? "button dark" : "button ghost"}
                  onClick={() => {
                    stopScanner();
                    setScanError("");
                    setAssignMode("manual");
                    window.requestAnimationFrame(() => assignInputRef.current?.focus());
                  }}
                >
                  Enter Asset ID
                </button>
              </div>

              {scanError ? <div className="page-message error">{scanError}</div> : null}

              <form className="inline-form" onSubmit={handleAssignLookupSubmit}>
                <input
                  ref={assignInputRef}
                  className="input"
                  placeholder="Paste an Asset ID or full scan URL"
                  value={assignLookupInput}
                  onChange={(event) => setAssignLookupInput(event.target.value)}
                />
                <button className="button dark" type="submit" disabled={assignLookupBusy}>{assignLookupBusy ? "Selecting..." : "Select Device"}</button>
                <button className="button ghost" type="button" onClick={handleSimulateScan} disabled={assignLookupBusy}>Simulate Scan</button>
              </form>

              {assignMode === "scan" ? (
                <div className="scan-mode-panel">
                  <div className="scan-reader scan-video-shell">
                    {scanEngine === "native" ? (
                      <video ref={videoRef} className="scan-video" autoPlay muted playsInline />
                    ) : (
                      <div id="assign-qr-reader" />
                    )}
                  </div>
                  {scanEngine === "native" ? <canvas ref={canvasRef} className="scan-canvas" /> : null}
                  <p className="scan-help">
                    {scanStatus === "requesting"
                      ? "Requesting camera permission..."
                      : scanStatus === "streaming"
                        ? "Point the camera at a device QR. The matching device will be selected automatically."
                        : "Click Scan QR to request camera access and start scanning."}
                  </p>
                </div>
              ) : (
                <div className="scan-mode-panel">
                  <p className="scan-help">Manual mode is active. Enter an Asset ID to select a device without navigating away.</p>
                </div>
              )}

              <div className="detail-item">
                <span>Decoded QR Value</span>
                <strong>{lastDecodedValue || "No scan yet"}</strong>
              </div>
            </div>

            {selectedAsset ? (
              <div className="device-detail-panel">
                <div className="selected-asset-banner">
                  <span>Active Device</span>
                  <strong>{getAssetId(selectedAsset)}</strong>
                </div>

                <div className="device-summary-grid">
                  <div className="detail-list">
                    <div className="detail-item"><span>Status</span><StatusPill status={selectedAsset.status} /></div>
                    <div className="detail-item"><span>SKU</span><strong>{selectedAsset.product?.sku || "-"}</strong></div>
                    <div className="detail-item"><span>Brand / Model</span><strong>{selectedAsset.product?.brand || "-"} {selectedAsset.product?.model || ""}</strong></div>
                    <div className="detail-item"><span>Serial Number</span><strong>{selectedAsset.serialNumber || "-"}</strong></div>
                    <div className="detail-item"><span>Location</span><strong>{selectedAsset.location?.name || "-"}</strong></div>
                    <div className="detail-item">
                      <span>Assigned To</span>
                      <strong>{selectedAsset.assignedTo ? `${selectedAsset.assignedTo.firstName} ${selectedAsset.assignedTo.lastName}` : "Unassigned"}</strong>
                    </div>
                  </div>

                  <QrPreviewPanel
                    asset={selectedAsset}
                    qrImageUrl={selectedAssetQrUrl}
                    qrLoading={selectedAssetQrLoading}
                    qrError={selectedAssetQrError}
                    copiedAssetId={copiedAssetId === getAssetId(selectedAsset)}
                    onCopyAssetId={() => copyAssetId(getAssetId(selectedAsset))}
                    onRegenerateQr={() => handleRegenerateQr(selectedAsset, "selected")}
                    regeneratingQr={selectedAssetQrRegenerating}
                  />
                </div>
              </div>
            ) : <div className="empty-state">Scan a QR code or enter an Asset ID above to auto-select a device for assignment.</div>}
          </SectionCard>

          <SectionCard title="Action Center" subtitle="Run status/location/assignee changes only on the selected device">
            <form className="form-grid" onSubmit={submitAction}>
              <fieldset className="action-fieldset" disabled={!selectedAsset || !validActionOptions.length}>
                <div className="selected-asset-banner">
                  <span>Action Target</span>
                  <strong>{getAssetId(selectedAsset) || "No device selected"}</strong>
                </div>

                {!selectedAsset ? <div className="action-hint">Choose a device first. This makes it obvious which asset the action will affect.</div> : null}
                {selectedAsset && !validActionOptions.length ? <div className="action-hint">No transitions are available for the current status.</div> : null}

                <select className="input" name="action" value={actionForm.action} onChange={handleActionChange} required>
                  {validActionOptions.length ? validActionOptions.map((action) => <option key={action} value={action}>{action}</option>) : <option value="">No valid actions</option>}
                </select>
                <select className="input" name="reason" value={actionForm.reason} onChange={handleActionChange} required>
                  {reasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
                <input className="input" name="customReason" placeholder="Custom reason" value={actionForm.customReason} onChange={handleActionChange} />
                <select className="input" name="locationId" value={actionForm.locationId} onChange={handleActionChange}>
                  <option value="">Target Location</option>
                  {setupData.locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}
                </select>
                {selectedAssetRequiresAssignee ? (
                  <select className="input" name="assignedToId" value={actionForm.assignedToId} onChange={handleActionChange} required>
                    <option value="">Target Assignee</option>
                    {setupData.users.map((user) => <option key={user._id} value={user._id}>{user.firstName} {user.lastName}</option>)}
                  </select>
                ) : null}
                {selectedAssetRequiresExternalRecipient ? (
                  <input className="input" name="externalRecipient" placeholder="External Recipient" value={actionForm.externalRecipient} onChange={handleActionChange} required />
                ) : null}
                {selectedAsset?.status === ASSET_STATUSES.ASSIGNED && actionForm.action === ASSET_ACTIONS.SEND_OUTSIDE ? (
                  <div className="action-hint">This device is assigned, so SEND_OUTSIDE will keep the current assignee as the outside holder.</div>
                ) : null}
                {actionForm.action === ASSET_ACTIONS.SEND_FOR_REPAIR ? <input className="input" name="issue" placeholder="Issue (repair only)" value={actionForm.issue} onChange={handleActionChange} /> : null}
                {actionForm.action === ASSET_ACTIONS.SEND_FOR_REPAIR ? <input className="input" name="vendor" placeholder="Vendor (repair only)" value={actionForm.vendor} onChange={handleActionChange} /> : null}
                {actionForm.action === ASSET_ACTIONS.SEND_FOR_REPAIR ? <input className="input" type="number" name="cost" placeholder="Cost" value={actionForm.cost} onChange={handleActionChange} /> : null}
                <textarea className="input textarea" name="notes" placeholder="Action notes" value={actionForm.notes} onChange={handleActionChange} />
                <button className="button dark" type="submit" disabled={!selectedAsset || !validActionOptions.length}>Apply Action To Selected Device</button>
              </fieldset>
            </form>
          </SectionCard>
        </div>
      ) : null}

      <form className="inline-form" onSubmit={submitCsv}>
        <input className="input" type="file" name="file" accept=".csv" />
        <button className="button" type="submit">Upload CSV</button>
      </form>
    </div>
  );
}
