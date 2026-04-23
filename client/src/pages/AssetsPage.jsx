import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  createAsset,
  deleteAsset,
  getAssetsBootstrap,
  getAssetAuditLogs,
  getAssetById,
  getAssetQrBlobUrl,
  listAssets,
  performAssetAction,
  regenerateAssetQr,
  updateAsset,
} from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { ActionMenu } from "../components/ActionMenu";
import { CopyIconButton } from "../components/CopyIconButton";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import {
  ASSET_ACTIONS,
  ASSET_STATUSES,
  getAssetActionLabel,
  getDisplayAssetStatus,
  getNextStatusForAction,
  getVisibleAssetStatuses,
  getValidActionsForStatus,
  isVisibleAssetStatus,
  normalizeAssetAction,
} from "../constants/assetWorkflow";
import { PERMISSIONS, hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import { useActionFeedback } from "../hooks/useActionFeedback";
import { getAssetId, getAssetLocationLabel, getAssetScanUrl, getAssetWfhAddress, isWfhLocation } from "../utils/asset.util";
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

function CopyableReferenceField({ label, value, copied, onCopy, renderValue }) {
  return (
    <div className="asset-reference">
      <span>{label}</span>
      <div className="asset-reference-row is-compact">
        <div className="asset-reference-shell">
          <div className="asset-reference-content">
            {renderValue(value)}
          </div>
          <div className="asset-reference-actions">
            <span className={copied ? "asset-reference-feedback is-visible" : "asset-reference-feedback"} aria-live="polite">
              Copied
            </span>
            <CopyIconButton value={value} onCopied={onCopy} className="asset-reference-copy-button" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetReference({ assetId, copied, onCopy }) {
  return (
    <CopyableReferenceField
      label="Asset ID"
      value={assetId}
      copied={copied}
      onCopy={onCopy}
      renderValue={(currentValue) => <code>{currentValue || "-"}</code>}
    />
  );
}

function ScanUrlField({ scanUrl, copied, onCopy }) {
  return (
    <CopyableReferenceField
      label="Scan URL"
      value={scanUrl}
      copied={copied}
      onCopy={onCopy}
      renderValue={(currentValue) => <input className="input scan-url-input" value={currentValue || "-"} readOnly />}
    />
  );
}

function InfoCardRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <strong className="info-value">{value || "-"}</strong>
    </div>
  );
}

function DeviceInfoCard({ asset }) {
  if (!asset) {
    return <div className="empty-state">Select a device to see its details.</div>;
  }

  return (
    <div className="info-card">
      <InfoCardRow label="Status" value={getDisplayAssetStatus(asset.status)} />
      <InfoCardRow label="SKU" value={asset.product?.sku} />
      <InfoCardRow label="Brand / Model" value={`${asset.product?.brand || "-"} ${asset.product?.model || ""}`.trim()} />
      <InfoCardRow label="Serial Number" value={asset.serialNumber} />
      <InfoCardRow label="Location" value={getAssetLocationLabel(asset)} />
      {isWfhLocation(asset) ? <InfoCardRow label="WFH Address" value={getAssetWfhAddress(asset)} /> : null}
      <InfoCardRow label="Assigned To" value={asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "Unassigned"} />
    </div>
  );
}

function QRCard({
  asset,
  qrImageUrl,
  qrLoading,
  qrError,
  copiedAssetId,
  onCopyAssetId,
  copiedScanUrl,
  onCopyScanUrl,
  onRegenerateQr,
  regeneratingQr = false,
}) {
  const assetId = getAssetId(asset);
  const scanUrl = getAssetScanUrl(asset);

  if (!asset) {
    return <div className="empty-state">Create or select a device to load its QR preview and copyable asset ID.</div>;
  }

  return (
    <div className="qr-card">
      <div className="qr-card-header">
        <div>
          <p className="qr-title">Generated QR</p>
          <strong>{assetId}</strong>
        </div>
        <div className="qr-card-actions">
          {onRegenerateQr ? (
            <button className="button ghost button-rect button-sm" type="button" onClick={onRegenerateQr} disabled={regeneratingQr}>
              {regeneratingQr ? "Regenerating..." : "Regenerate QR"}
            </button>
          ) : null}
          <StatusPill status={asset.status} />
        </div>
      </div>

      {qrLoading ? <div className="page-message">Fetching QR with your authenticated session...</div> : null}
      {qrError ? <div className="page-message error">{qrError}</div> : null}
      <div className="qr-card-body">
        {qrImageUrl ? (
          <img className="qr-preview qr-preview-fluid" src={qrImageUrl} alt={`QR for ${assetId}`} />
        ) : (
          <div className="qr-placeholder">QR preview will appear here as soon as it is available.</div>
        )}
      </div>
      {qrImageUrl ? (
        <a className="button dark button-rect" href={qrImageUrl} download={`${assetId}-qr.png`}>
          Download QR
        </a>
      ) : null}

      <AssetReference assetId={assetId} copied={copiedAssetId} onCopy={onCopyAssetId} />

      <ScanUrlField scanUrl={scanUrl} copied={copiedScanUrl} onCopy={onCopyScanUrl} />
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

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

const emptySetupData = {
  products: [],
  locations: [],
  users: [],
};

function buildDefaultActionForm(action = "", asset = null) {
  return {
    action,
    notes: "",
    assignedToId: "",
    locationType: isWfhLocation(asset) ? "WFH" : "PHYSICAL",
    locationId: "",
    wfhAddress: "",
    issue: "",
    vendor: "",
    cost: "",
    customerName: "",
    customerContact: "",
    rentalStartDate: "",
    rentalEndDate: "",
    rentalCost: "",
    buyerName: "",
    salePrice: "",
    invoiceNumber: "",
    saleDate: "",
  };
}

const DEFAULT_ACTION_FORM = buildDefaultActionForm();

function resetActionFormForAction(currentForm, action, asset) {
  return {
    ...buildDefaultActionForm(action, asset),
    notes: currentForm?.notes || "",
  };
}

function getLocationById(locations, locationId) {
  return locations.find((location) => String(location?._id || "") === String(locationId || "")) || null;
}

function getUserById(users, userId) {
  return users.find((user) => String(user?._id || "") === String(userId || "")) || null;
}

function getActionValidationError(form, selectedAsset) {
  if (!selectedAsset) {
    return "Select a device first. The action form only works on the selected device.";
  }

  const action = normalizeAssetAction(form.action);
  if (action === ASSET_ACTIONS.ASSIGN_DEVICE && !form.assignedToId) {
    return "Select a user to assign this device.";
  }

  if (action === ASSET_ACTIONS.TRANSFER) {
    const nextLocationType = String(form.locationType || "").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
    const nextWfhAddress = String(form.wfhAddress || "").trim();
    const nextLocationId = String(form.locationId || "").trim();
    const currentLocationType = isWfhLocation(selectedAsset) ? "WFH" : "PHYSICAL";
    const currentWfhAddress = getAssetWfhAddress(selectedAsset);
    const currentLocationId = String(selectedAsset?.location?._id || "").trim();

    if (nextLocationType === "WFH") {
      if (!nextWfhAddress) {
        return "WFH address is required when transferring to WFH.";
      }
      if (currentLocationType === "WFH" && currentWfhAddress === nextWfhAddress) {
        return "Choose a different WFH address for this transfer.";
      }
      return "";
    }

    if (!nextLocationId) {
      return "Select a target location for this transfer.";
    }

    if (currentLocationType === "PHYSICAL" && currentLocationId === nextLocationId) {
      return "Choose a different location for this transfer.";
    }
  }

  if (action === ASSET_ACTIONS.SEND_FOR_REPAIR) {
    if (!String(form.issue || "").trim()) return "Issue is required before sending for repair.";
    if (!String(form.vendor || "").trim()) return "Vendor is required before sending for repair.";
    if (form.cost === "") return "Cost is required before sending for repair.";
  }

  if (action === ASSET_ACTIONS.RENT_OUT) {
    if (!String(form.customerName || "").trim()) return "Customer name is required to rent out this asset.";
    if (!String(form.customerContact || "").trim()) return "Customer contact is required to rent out this asset.";
    if (!String(form.rentalStartDate || "").trim()) return "Rental start date is required.";
    if (!String(form.rentalEndDate || "").trim()) return "Rental end date is required.";
    if (form.rentalCost === "") return "Rental cost is required.";
  }

  if (action === ASSET_ACTIONS.SELL) {
    if (!String(form.buyerName || "").trim()) return "Buyer name is required to sell this asset.";
    if (form.salePrice === "") return "Sale price is required.";
    if (!String(form.invoiceNumber || "").trim()) return "Invoice number is required.";
    if (!String(form.saleDate || "").trim()) return "Sale date is required.";
  }

  return "";
}

function buildActionPayload(form) {
  const action = normalizeAssetAction(form.action);
  const payload = {
    action,
    notes: String(form.notes || "").trim(),
  };

  if (action === ASSET_ACTIONS.ASSIGN_DEVICE) {
    payload.assignedToId = form.assignedToId || null;
  }

  if (action === ASSET_ACTIONS.TRANSFER) {
    payload.locationType = String(form.locationType || "").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
    payload.locationId = payload.locationType === "WFH" ? null : form.locationId || null;
    payload.wfhAddress = payload.locationType === "WFH" ? String(form.wfhAddress || "").trim() : "";
  }

  if (action === ASSET_ACTIONS.SEND_FOR_REPAIR) {
    payload.issue = String(form.issue || "").trim();
    payload.vendor = String(form.vendor || "").trim();
    payload.cost = form.cost;
  }

  if (action === ASSET_ACTIONS.RENT_OUT) {
    payload.customerName = String(form.customerName || "").trim();
    payload.customerContact = String(form.customerContact || "").trim();
    payload.rentalStartDate = form.rentalStartDate;
    payload.rentalEndDate = form.rentalEndDate;
    payload.rentalCost = form.rentalCost;
  }

  if (action === ASSET_ACTIONS.SELL) {
    payload.buyerName = String(form.buyerName || "").trim();
    payload.salePrice = form.salePrice;
    payload.invoiceNumber = String(form.invoiceNumber || "").trim();
    payload.saleDate = form.saleDate;
  }

  return payload;
}

function buildOptimisticAssetUpdate(asset, form, setupData) {
  if (!asset) return asset;

  const action = normalizeAssetAction(form.action);
  const nextAsset = {
    ...asset,
    status: getNextStatusForAction(asset.status, action) || asset.status,
  };

  if (action === ASSET_ACTIONS.ASSIGN_DEVICE) {
    nextAsset.assignedTo = getUserById(setupData.users, form.assignedToId);
  }

  if (action === ASSET_ACTIONS.TRANSFER) {
    const nextLocationType = String(form.locationType || "").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
    nextAsset.locationType = nextLocationType;
    nextAsset.wfhAddress = nextLocationType === "WFH" ? String(form.wfhAddress || "").trim() : "";
    if (nextLocationType === "PHYSICAL") {
      nextAsset.location = getLocationById(setupData.locations, form.locationId) || asset.location;
    }
  }

  if (
    action === ASSET_ACTIONS.RETURN_DEVICE ||
    action === ASSET_ACTIONS.RENT_OUT ||
    action === ASSET_ACTIONS.SEND_FOR_REPAIR ||
    action === ASSET_ACTIONS.SELL ||
    action === ASSET_ACTIONS.MARK_LOST
  ) {
    nextAsset.assignedTo = null;
  }

  return nextAsset;
}

function renderActionFields({ action, actionForm, handleActionChange, selectedAsset, setupData }) {
  const normalizedAction = normalizeAssetAction(action);

  if (normalizedAction === ASSET_ACTIONS.ASSIGN_DEVICE) {
    return (
      <select className="input" name="assignedToId" value={actionForm.assignedToId} onChange={handleActionChange} required>
        <option value="">Assign to user</option>
        {setupData.users.map((user) => (
          <option key={user._id} value={user._id}>
            {user.firstName} {user.lastName}
          </option>
        ))}
      </select>
    );
  }

  if (normalizedAction === ASSET_ACTIONS.TRANSFER) {
    return (
      <>
        <select className="input" name="locationType" value={actionForm.locationType} onChange={handleActionChange}>
          <option value="PHYSICAL">Physical location</option>
          <option value="WFH">WFH</option>
        </select>
        {actionForm.locationType === "WFH" ? (
          <textarea
            className="input textarea"
            name="wfhAddress"
            placeholder="WFH address"
            value={actionForm.wfhAddress}
            onChange={handleActionChange}
            required
          />
        ) : (
          <select className="input" name="locationId" value={actionForm.locationId} onChange={handleActionChange} required>
            <option value="">Transfer to location</option>
            {setupData.locations
              .filter((location) => (
                isWfhLocation(selectedAsset) || String(location?._id || "") !== String(selectedAsset?.location?._id || "")
              ))
              .map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name}
                </option>
              ))}
          </select>
        )}
      </>
    );
  }

  if (normalizedAction === ASSET_ACTIONS.SEND_FOR_REPAIR) {
    return (
      <>
        <input className="input" name="issue" placeholder="Issue" value={actionForm.issue} onChange={handleActionChange} required />
        <input className="input" name="vendor" placeholder="Vendor" value={actionForm.vendor} onChange={handleActionChange} required />
        <input className="input" name="cost" type="number" min="0" step="0.01" placeholder="Repair cost" value={actionForm.cost} onChange={handleActionChange} required />
      </>
    );
  }

  if (normalizedAction === ASSET_ACTIONS.RENT_OUT) {
    return (
      <>
        <input className="input" name="customerName" placeholder="Customer name" value={actionForm.customerName} onChange={handleActionChange} required />
        <input className="input" name="customerContact" placeholder="Customer contact" value={actionForm.customerContact} onChange={handleActionChange} required />
        <input className="input" name="rentalStartDate" type="date" value={actionForm.rentalStartDate} onChange={handleActionChange} required />
        <input className="input" name="rentalEndDate" type="date" value={actionForm.rentalEndDate} onChange={handleActionChange} required />
        <input className="input" name="rentalCost" type="number" min="0" step="0.01" placeholder="Rental cost" value={actionForm.rentalCost} onChange={handleActionChange} required />
      </>
    );
  }

  if (normalizedAction === ASSET_ACTIONS.SELL) {
    return (
      <>
        <input className="input" name="buyerName" placeholder="Buyer name" value={actionForm.buyerName} onChange={handleActionChange} required />
        <input className="input" name="salePrice" type="number" min="0" step="0.01" placeholder="Sale price" value={actionForm.salePrice} onChange={handleActionChange} required />
        <input className="input" name="invoiceNumber" placeholder="Invoice number" value={actionForm.invoiceNumber} onChange={handleActionChange} required />
        <input className="input" name="saleDate" type="date" value={actionForm.saleDate} onChange={handleActionChange} required />
      </>
    );
  }

  return null;
}

export function AssetsPage({ forcedTab = null, incomingAsset = null }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupData, setSetupData] = useState(emptySetupData);
  const [setupLoading, setSetupLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const initialTab = forcedTab ? normalizeTab(forcedTab) : normalizeTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState(initialTab);
  const [assets, setAssets] = useState([]);
  const [assetLogs, setAssetLogs] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const nextStatus = searchParams.get("status") || "";
    return isVisibleAssetStatus(nextStatus) ? nextStatus : "";
  });
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
  const [copiedScanUrl, setCopiedScanUrl] = useState("");
  const [assignMode, setAssignMode] = useState("scan");
  const [assignLookupInput, setAssignLookupInput] = useState("");
  /** Tracks in-flight actions: create-device, assign-lookup, asset-action:<id>, edit-asset:<id>, delete-asset:<id> */
  const [busyKey, setBusyKey] = useState("");
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
  const flashTimeoutRef = useRef(null);
  const [flashRowId, setFlashRowId] = useState("");
  const [flashRowVariant, setFlashRowVariant] = useState("success");
  const [createForm, setCreateForm] = useState({
    productId: "",
    serialNumber: "",
    locationType: "PHYSICAL",
    locationId: "",
    wfhAddress: "",
    assignedToId: "",
    notes: "",
  });
  const [showCreateDeviceForm, setShowCreateDeviceForm] = useState(true);
  const searchDebounceRef = useRef(null);
  const previousSearchRef = useRef("");
  const incomingAssetId = incomingAsset?._id || "";
  const urlAssetIdForSelection = String(searchParams.get("assetId") || "").trim();
  const pendingConsumeAssetId = String(incomingAssetId || urlAssetIdForSelection).trim();

  const canCreateAsset = hasPermission(currentUser, PERMISSIONS.CREATE_ASSET);
  const canUpdateAsset = hasPermission(currentUser, PERMISSIONS.UPDATE_ASSET);
  const canDeleteAsset = hasPermission(currentUser, PERMISSIONS.DELETE_ASSET);
  const canEditOrDeleteFromRegistry = canUpdateAsset || canDeleteAsset;

  const [editingAsset, setEditingAsset] = useState(null);
  const [editForm, setEditForm] = useState({
    productId: "",
    serialNumber: "",
    locationType: "PHYSICAL",
    locationId: "",
    wfhAddress: "",
    assignedToId: "",
    status: ASSET_STATUSES.AVAILABLE,
  });
  const [deleteAssetTarget, setDeleteAssetTarget] = useState(null);
  const selectionFeedback = useActionFeedback();
  const createFeedback = useActionFeedback({ preferGlobal: true });
  const workflowFeedback = useActionFeedback();
  const modalFeedback = useActionFeedback();
  const [actionForm, setActionForm] = useState(DEFAULT_ACTION_FORM);
  const validActionOptions = getValidActionsForStatus(selectedAsset?.status);
  const actionValidationError = getActionValidationError(actionForm, selectedAsset);
  const isActionFormValid = !actionValidationError && validActionOptions.includes(actionForm.action);
  const canPerformSelectedAction = canUpdateAsset;

  const selectedAssetScanUrl = useMemo(() => getAssetScanUrl(selectedAsset), [selectedAsset]);
  const createdAssetScanUrl = useMemo(() => getAssetScanUrl(latestCreatedAsset), [latestCreatedAsset]);

  function copyAssetId(assetId) {
    if (!assetId) return;
    setCopiedAssetId(assetId);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopiedAssetId(""), 1800);
  }

  function copyScanUrl(scanUrl) {
    if (!scanUrl) return;
    setCopiedScanUrl(scanUrl);
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopiedScanUrl(""), 1800);
  }

  function clearSelectedAssetState() {
    setSelectedAssetId("");
    setSelectedAsset(null);
    setAssetLogs([]);
    setAssignLookupInput("");
  }

  function updateActiveTab(nextTab) {
    const normalizedTab = normalizeTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);

    if (normalizedTab === "registry") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", normalizedTab);
    }

    if (normalizedTab !== "assign") {
      clearSelectedAssetState();
    }

    if (normalizedTab === "assign" && location.pathname !== "/assign-device") {
      navigate(
        {
          pathname: "/assign-device",
          search: nextParams.toString() ? `?${nextParams.toString()}` : "",
        },
        {
          state: selectedAsset ? { asset: selectedAsset } : null,
        }
      );
      return;
    }

    if (normalizedTab !== "assign" && location.pathname === "/assign-device") {
      navigate({
        pathname: "/assets",
        search: nextParams.toString() ? `?${nextParams.toString()}` : "",
      });
      return;
    }

    setActiveTab(normalizedTab);
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    if (activeTab === "add" && !canCreateAsset) {
      updateActiveTab("registry");
    }
  }, [activeTab, canCreateAsset]);

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
      .catch((err) => setLoadError(err.message));
  }

  function buildAssetListFilters(nextSearch) {
    const normalizedSearch = String(nextSearch ?? search).trim();
    const filters = {};
    if (normalizedSearch) filters.search = normalizedSearch;
    if (statusFilter) filters.status = statusFilter;
    return filters;
  }

  async function loadSetupData() {
    try {
      setLoadError("");
      setSetupLoading(true);
      const data = await getAssetsBootstrap();
      setSetupData({
        products: Array.isArray(data?.products) ? data.products : [],
        locations: Array.isArray(data?.locations) ? data.locations : [],
        users: Array.isArray(data?.users) ? data.users : [],
      });
    } catch (err) {
      setLoadError(err.message);
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
      selectionFeedback.showSuccess(selectionMessage);
    }
  }

  function flashRow(assetMongoId, variant = "success") {
    if (!assetMongoId) return;
    setFlashRowId(assetMongoId);
    setFlashRowVariant(variant);
    window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashRowId("");
      setFlashRowVariant("success");
    }, 1400);
  }

  async function handleRegenerateQr(asset, target) {
    if (!asset?._id) {
      return;
    }

    const setRegenerating = target === "selected" ? setSelectedAssetQrRegenerating : setCreatedAssetQrRegenerating;
    setRegenerating(true);
    workflowFeedback.clear();

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
      (target === "created" ? createFeedback : workflowFeedback).showSuccess(`QR regenerated for ${getAssetId(refreshedAsset)}.`);
    } catch (err) {
      (target === "created" ? createFeedback : workflowFeedback).showError(err.message || "Unable to regenerate the QR code.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSelectAsset(assetId) {
    selectionFeedback.clear();

    try {
      const asset = await getAssetById(assetId);
      await applySelectedAsset(asset, `Selected ${getAssetId(asset)}. Actions now apply only to this device.`);
    } catch (err) {
      selectionFeedback.showError(err.message || "Unable to select device.");
    }
  }

  async function lookupAndSelectAsset(rawInput, sourceLabel) {
    const assetIdentifier = extractAssetId(rawInput);
    if (!assetIdentifier) throw new Error("Enter a valid asset ID or scan URL.");

    const asset = await getAssetById(assetIdentifier);
    const resolvedAssetId = getAssetId(asset);
    const registrySearch = assets.some((item) => item._id === asset._id) ? search : resolvedAssetId;
    setAssignLookupInput(resolvedAssetId);
    setSearchInput(registrySearch);
    previousSearchRef.current = registrySearch.trim();
    setSearch(registrySearch);
    await loadAssets(buildAssetListFilters(registrySearch));
    await applySelectedAsset(asset, `${resolvedAssetId} is now selected from ${sourceLabel}.`);
    return asset;
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
    setBusyKey("assign-lookup");
    selectionFeedback.clear();

    try {
      await lookupAndSelectAsset(assetIdentifier, sourceLabel);
    } catch (err) {
      selectionFeedback.showError(err.message || "Unable to select the scanned device.");
      fallbackToManual("The scanned value could not be matched to a device. Manual Asset ID entry has been enabled.");
      return;
    } finally {
      setBusyKey("");
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
    selectionFeedback.clear();
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
  }, []);

  useEffect(() => {
    window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (previousSearchRef.current !== nextSearch) {
        previousSearchRef.current = nextSearch;
        setSearch(nextSearch);
      }
    }, 300);

    return () => window.clearTimeout(searchDebounceRef.current);
  }, [searchInput]);

  useEffect(() => {
    const nextTab = forcedTab ? normalizeTab(forcedTab) : normalizeTab(searchParams.get("tab"));
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [forcedTab, searchParams]);

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "";
    const visibleStatus = isVisibleAssetStatus(nextStatus) ? nextStatus : "";
    setStatusFilter((current) => (current === visibleStatus ? current : visibleStatus));
  }, [searchParams]);

  useEffect(() => {
    loadAssets(buildAssetListFilters());
  }, [search, statusFilter]);

  useEffect(() => {
    if (!pendingConsumeAssetId) return;

    let isCancelled = false;

    async function consumeIncomingAsset() {
      try {
        const asset = await getAssetById(pendingConsumeAssetId);
        if (isCancelled) return;
        await applySelectedAsset(asset);
      } catch (err) {
        if (isCancelled) return;
        selectionFeedback.showError(err.message || "Unable to load the selected device.");
      } finally {
        if (!isCancelled) {
          const nextParams = new URLSearchParams(location.search);
          nextParams.delete("assetId");
          navigate(
            {
              pathname: location.pathname,
              search: nextParams.toString() ? `?${nextParams.toString()}` : "",
            },
            { replace: true, state: null }
          );
        }
      }
    }

    consumeIncomingAsset();

    return () => {
      isCancelled = true;
    };
  }, [pendingConsumeAssetId, location.pathname, location.search, navigate, selectionFeedback]);

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
      return resetActionFormForAction(current, nextAction, selectedAsset);
    });
  }, [selectedAsset?._id, selectedAsset?.status, selectedAsset?.locationType, selectedAsset?.wfhAddress]);

  useEffect(() => {
    return () => {
      stopScanner();
      if (selectedAssetQrUrl) URL.revokeObjectURL(selectedAssetQrUrl);
      if (createdAssetQrUrl) URL.revokeObjectURL(createdAssetQrUrl);
      window.clearTimeout(copyTimeoutRef.current);
      window.clearTimeout(searchDebounceRef.current);
    };
  }, [selectedAssetQrUrl, createdAssetQrUrl]);

  function handleCreateChange(event) {
    const { name, value } = event.target;
    if (name === "locationType") {
      setCreateForm((current) => ({
        ...current,
        locationType: value,
        locationId: value === "WFH" ? "" : current.locationId,
        wfhAddress: value === "WFH" ? current.wfhAddress : "",
      }));
      return;
    }
    setCreateForm((current) => ({
      ...current,
      [name]: name === "serialNumber" ? digitsOnly(value) : value,
    }));
  }

  function openEditAssetModal(asset) {
    modalFeedback.clear();
    setEditingAsset(asset);
    setEditForm({
      productId: asset?.product?._id || "",
      serialNumber: asset?.serialNumber || "",
      locationType: isWfhLocation(asset) ? "WFH" : "PHYSICAL",
      locationId: asset?.location?._id || "",
      wfhAddress: getAssetWfhAddress(asset),
      assignedToId: asset?.assignedTo?._id || "",
      status: asset?.status || ASSET_STATUSES.AVAILABLE,
    });
  }

  async function submitEditAsset() {
    if (!editingAsset?._id) return;

    modalFeedback.clear();
    if (editForm.serialNumber && !/^\d+$/.test(String(editForm.serialNumber))) {
      modalFeedback.showError("Serial Number must contain digits only.");
      return;
    }
    if (editForm.locationType === "WFH" && !String(editForm.wfhAddress || "").trim()) {
      modalFeedback.showError("WFH Address is required when location is WFH.");
      return;
    }
    if (editForm.locationType !== "WFH" && !editForm.locationId) {
      modalFeedback.showError("Location is required.");
      return;
    }
    const editKey = `edit-asset:${editingAsset._id}`;
    setBusyKey(editKey);

    try {
      await updateAsset(editingAsset._id, {
        productId: editForm.productId || null,
        serialNumber: digitsOnly(editForm.serialNumber) || "",
        locationType: editForm.locationType === "WFH" ? "WFH" : "PHYSICAL",
        locationId: editForm.locationType === "WFH" ? null : editForm.locationId || null,
        wfhAddress: editForm.locationType === "WFH" ? String(editForm.wfhAddress || "").trim() : "",
        assignedToId: editForm.assignedToId || null,
        status: editForm.status,
      });
      setEditingAsset(null);
      await loadAssets(buildAssetListFilters());
      if (selectedAssetId === editingAsset._id) {
        await handleSelectAsset(editingAsset._id);
      }
      modalFeedback.showSuccess("Asset updated successfully.");
    } catch (err) {
      modalFeedback.showError(err.message || "Unable to update asset.");
    } finally {
      setBusyKey("");
    }
  }

  async function confirmDeleteAsset() {
    if (!deleteAssetTarget?._id) return;

    modalFeedback.clear();
    const deleteKey = `delete-asset:${deleteAssetTarget._id}`;
    setBusyKey(deleteKey);

    try {
      await deleteAsset(deleteAssetTarget._id);
      const deletedId = deleteAssetTarget._id;
      setDeleteAssetTarget(null);
      await loadAssets(buildAssetListFilters());
      if (selectedAssetId === deletedId) {
        setSelectedAssetId("");
        setSelectedAsset(null);
        setAssetLogs([]);
      }
      modalFeedback.showSuccess("Asset deleted successfully.");
    } catch (err) {
      modalFeedback.showError(err.message || "Unable to delete asset.");
    } finally {
      setBusyKey("");
    }
  }

  function handleActionChange(event) {
    const { name, value } = event.target;
    setActionForm((current) => {
      if (name === "action") {
        return resetActionFormForAction(current, value, selectedAsset);
      }

      if (name === "locationType") {
        return {
          ...current,
          locationType: value,
          locationId: value === "WFH" ? "" : current.locationId,
          wfhAddress: value === "WFH" ? current.wfhAddress : "",
        };
      }

      return { ...current, [name]: value };
    });
  }

  async function submitAsset(event) {
    event.preventDefault();
    createFeedback.clear();

    try {
      if (createForm.serialNumber && !/^\d+$/.test(String(createForm.serialNumber))) {
        createFeedback.showError("Serial Number must contain digits only.", { global: true });
        return;
      }
      if (createForm.locationType === "WFH" && !String(createForm.wfhAddress || "").trim()) {
        createFeedback.showError("WFH Address is required when location is WFH.", { global: true });
        return;
      }
      if (createForm.locationType !== "WFH" && !createForm.locationId) {
        createFeedback.showError("Location is required.", { global: true });
        return;
      }
      setBusyKey("create-device");
      const createdAsset = await createAsset({
        ...createForm,
        locationType: createForm.locationType === "WFH" ? "WFH" : "PHYSICAL",
        locationId: createForm.locationType === "WFH" ? null : createForm.locationId || null,
        wfhAddress: createForm.locationType === "WFH" ? String(createForm.wfhAddress || "").trim() : "",
        assignedToId: createForm.assignedToId || null,
      });
      setLatestCreatedAsset(createdAsset);
      createFeedback.showSuccess(`Asset ${getAssetId(createdAsset)} created. QR is shown below in this section.`, { global: true });
      setCreateForm({ productId: "", serialNumber: "", locationType: "PHYSICAL", locationId: "", wfhAddress: "", assignedToId: "", notes: "" });
      setShowCreateDeviceForm(false);
      await loadAssets(buildAssetListFilters());
      await handleSelectAsset(createdAsset._id);
    } catch (err) {
      createFeedback.showError(err.message || "Unable to create asset.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleAssignLookupSubmit(event) {
    event.preventDefault();
    setBusyKey("assign-lookup");
    selectionFeedback.clear();

    try {
      await lookupAndSelectAsset(assignLookupInput, "manual Asset ID entry");
    } catch (err) {
      selectionFeedback.showError(err.message || "Device not found.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSimulateScan() {
    if (busyKey === "assign-lookup") {
      return;
    }
    if (!assignLookupInput.trim()) {
      setScanError("Enter an Asset ID first to simulate a scan.");
      return;
    }

    setScanError("");
    await processScannedValue(assignLookupInput, "simulated scan");
  }

  async function submitAction(event) {
    event.preventDefault();
    const normalizedAction = normalizeAssetAction(actionForm.action);

    if (!canPerformSelectedAction) {
      workflowFeedback.showError("Missing permission: UPDATE_ASSET");
      return;
    }

    if (!selectedAssetId) {
      workflowFeedback.showError("Select a device first. The action form only works on the selected device.");
      return;
    }

    if (!validActionOptions.includes(normalizedAction)) {
      workflowFeedback.showError("This device does not allow that action in its current status.");
      return;
    }

    if (actionValidationError) {
      workflowFeedback.showError(actionValidationError);
      return;
    }

    workflowFeedback.clear();
    const actionBusyKey = `asset-action:${selectedAssetId}`;
    setBusyKey(actionBusyKey);

    const previousSelected = selectedAsset;
    const previousAssets = assets;
    const optimisticAsset = buildOptimisticAssetUpdate(selectedAsset, { ...actionForm, action: normalizedAction }, setupData);

    // Optimistic UI: badge + row highlight + immediate list update.
    setSelectedAsset(optimisticAsset);
    setAssets((current) =>
      current.map((a) =>
        a._id === selectedAssetId
          ? buildOptimisticAssetUpdate(a, { ...actionForm, action: normalizedAction }, setupData)
          : a
      )
    );
    flashRow(selectedAssetId, "success");

    try {
      const result = await performAssetAction(selectedAssetId, buildActionPayload({ ...actionForm, action: normalizedAction }));

      setSelectedAsset(result.asset);
      workflowFeedback.showSuccess(`${getAssetActionLabel(normalizedAction)} completed for ${getAssetId(result.asset)}.`);
      await loadAssets(buildAssetListFilters());
      const logs = await getAssetAuditLogs(selectedAssetId);
      setAssetLogs(logs);
    } catch (err) {
      // Revert optimistic update and show local inline error.
      setSelectedAsset(previousSelected);
      setAssets(previousAssets);
      flashRow(selectedAssetId, "error");
      workflowFeedback.showError(err.message || "Action failed.");
    } finally {
      setBusyKey("");
    }
  }

  if (setupLoading) {
    return <div className="page-message">Loading assets workspace...</div>;
  }

  return (
    <div className="page-stack">
      {loadError ? <div className="page-message error">{loadError}</div> : null}

      <div className="asset-tabs" role="tablist" aria-label="Device management sections">
        {sectionTabs
          .filter((tab) => (tab.id === "add" ? canCreateAsset : true))
          .map((tab) => {
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
              <div className="inline-form">
                <input
                  className="input"
                  placeholder="Search by asset code, SKU, or serial"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>
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
                  {canEditOrDeleteFromRegistry ? <th>Actions</th> : null}
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {assets.length ? assets.map((asset) => (
                  <tr
                    key={asset._id}
                    className={[
                      selectedAssetId === asset._id ? "selected-row" : "",
                      flashRowId === asset._id ? `row-flash ${flashRowVariant === "error" ? "is-error" : ""}` : "",
                    ].join(" ").trim()}
                    onClick={() => handleSelectAsset(asset._id)}
                  >
                    <td>
                      <strong>{getAssetId(asset)}</strong>
                      <div className="table-subtle">{asset.serialNumber || "No serial number"}</div>
                    </td>
                    <td>{asset.product?.sku}</td>
                    <td><StatusPill status={asset.status} /></td>
                    <td>{getAssetLocationLabel(asset)}</td>
                    <td>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}</td>
                    {canEditOrDeleteFromRegistry ? (
                      <td onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          label={`Asset actions for ${getAssetId(asset)}`}
                          items={[
                            {
                              id: "edit",
                              label: "Edit Asset",
                              icon: "✏️",
                              hidden: !canUpdateAsset,
                              onClick: () => openEditAssetModal(asset),
                            },
                            {
                              id: "delete",
                              label: "Delete Asset",
                              icon: "🗑️",
                              danger: true,
                              hidden: !canDeleteAsset,
                              onClick: () => {
                                modalFeedback.clear();
                                setDeleteAssetTarget(asset);
                              },
                            },
                          ]}
                        />
                      </td>
                    ) : null}
                    <td>
                      <button
                        className={selectedAssetId === asset._id ? "button ghost button-rect button-sm is-selected" : "button ghost button-rect button-sm"}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate("/assign-device", { state: { asset } });
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={canEditOrDeleteFromRegistry ? 7 : 6}>No results found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "add" && canCreateAsset ? (
        <SectionCard title="Create Device" subtitle="Create a physical asset and immediately preview its QR in the same section">
          <div className="assets-two-col">
            <SectionCard title="Device details" subtitle="Fill the fields, then create the device.">
              {showCreateDeviceForm ? (
              <form className="form-grid wide-grid" onSubmit={submitAsset}>
              <select className="input" name="productId" value={createForm.productId} onChange={handleCreateChange} required>
                <option value="">Select SKU</option>
                {setupData.products.map((product) => <option key={product._id} value={product._id}>{product.sku} - {product.brand} {product.model}</option>)}
              </select>
              <input
                className="input"
                name="serialNumber"
                placeholder="Serial Number"
                value={createForm.serialNumber}
                onChange={handleCreateChange}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <select className="input" name="locationType" value={createForm.locationType} onChange={handleCreateChange}>
                <option value="PHYSICAL">PHYSICAL</option>
                <option value="WFH">WFH</option>
              </select>
              {createForm.locationType === "WFH" ? (
                <textarea
                  className="input textarea"
                  name="wfhAddress"
                  placeholder="WFH Address"
                  value={createForm.wfhAddress}
                  onChange={handleCreateChange}
                  required
                />
              ) : (
                <select className="input" name="locationId" value={createForm.locationId} onChange={handleCreateChange} required>
                  <option value="">Initial Location</option>
                  {setupData.locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}
                </select>
              )}
              <select className="input" name="assignedToId" value={createForm.assignedToId} onChange={handleCreateChange}>
                <option value="">Assigned To (optional)</option>
                {setupData.users.map((user) => <option key={user._id} value={user._id}>{user.firstName} {user.lastName}</option>)}
              </select>
              <textarea className="input textarea assets-full" name="notes" placeholder="Creation notes" value={createForm.notes} onChange={handleCreateChange} />
              <div className="form-actions assets-full">
                <button
                  className="button dark button-rect with-spinner"
                  type="submit"
                  disabled={busyKey === "create-device" || createdAssetQrRegenerating}
                >
                  {busyKey === "create-device" || createdAssetQrRegenerating ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                  <span>{busyKey === "create-device" ? "Creating..." : createdAssetQrRegenerating ? "Working..." : "Create Device"}</span>
                </button>
              </div>
              </form>
              ) : (
                <div className="page-stack">
                  <div className="page-message success">Device created. You can review its QR and details on the right.</div>
                  <button
                    className="button dark button-rect"
                    type="button"
                    onClick={() => {
                      setCreateForm({ productId: "", serialNumber: "", locationType: "PHYSICAL", locationId: "", wfhAddress: "", assignedToId: "", notes: "" });
                      setShowCreateDeviceForm(true);
                      createFeedback.clear();
                    }}
                  >
                    Create Another Device
                  </button>
                </div>
              )}
              <ActionFeedback
                type={createFeedback.feedback?.type}
                message={createFeedback.feedback?.message}
                autoDismissMs={createFeedback.feedback?.autoDismissMs}
                onClose={createFeedback.clear}
                className="action-feedback-inline"
              />
            </SectionCard>

            <SectionCard title="QR + actions" subtitle="Download, copy, or regenerate the QR for this device.">
              <QRCard
                asset={latestCreatedAsset}
                qrImageUrl={createdAssetQrUrl}
                qrLoading={createdAssetQrLoading}
                qrError={createdAssetQrError}
                copiedAssetId={copiedAssetId === getAssetId(latestCreatedAsset)}
                onCopyAssetId={() => copyAssetId(getAssetId(latestCreatedAsset))}
                copiedScanUrl={copiedScanUrl === createdAssetScanUrl}
                onCopyScanUrl={() => copyScanUrl(createdAssetScanUrl)}
                onRegenerateQr={() => handleRegenerateQr(latestCreatedAsset, "created")}
                regeneratingQr={createdAssetQrRegenerating}
              />
            </SectionCard>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "assign" ? (
        <div className="assets-two-col">
          <div className="page-stack">
            {!selectedAsset ? (
              <SectionCard title="Select Device" subtitle="Scan a QR code or enter an Asset ID to target actions.">
                <div className="assign-selector">
                <div className="mode-toggle" role="tablist" aria-label="Device selection mode">
                  {!selectedAsset ? (
                  <button type="button" className={assignMode === "scan" ? "button dark" : "button ghost"} onClick={startScanner}>Scan QR</button>
                  ) : null}
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
                  <button className="button dark with-spinner" type="submit" disabled={busyKey === "assign-lookup"}>
                    {busyKey === "assign-lookup" ? <span className="button-spinner" aria-hidden /> : null}
                    <span>{busyKey === "assign-lookup" ? "Selecting..." : "Select Device"}</span>
                  </button>
                  {/* <button className="button ghost" type="button" onClick={handleSimulateScan} disabled={busyKey === "assign-lookup"}>
                    Simulate Scan
                  </button> */}
                </form>
                <ActionFeedback
                  type={selectionFeedback.feedback?.type}
                  message={selectionFeedback.feedback?.message}
                  autoDismissMs={selectionFeedback.feedback?.autoDismissMs}
                  onClose={selectionFeedback.clear}
                  className="action-feedback-inline"
                />

                {assignMode === "scan" && !selectedAsset ? (
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
              </SectionCard>
            ) : null}

            <SectionCard title="Device Info" subtitle="The selected device details will appear here.">
              <DeviceInfoCard asset={selectedAsset} />
            </SectionCard>
          </div>

          <div className="page-stack">
            <SectionCard title="QR + actions" subtitle="QR tools and workflow actions for the selected device.">
              <div className="page-stack">
                <QRCard
                  asset={selectedAsset}
                  qrImageUrl={selectedAssetQrUrl}
                  qrLoading={selectedAssetQrLoading}
                  qrError={selectedAssetQrError}
                  copiedAssetId={copiedAssetId === getAssetId(selectedAsset)}
                  onCopyAssetId={() => copyAssetId(getAssetId(selectedAsset))}
                  copiedScanUrl={copiedScanUrl === selectedAssetScanUrl}
                  onCopyScanUrl={() => copyScanUrl(selectedAssetScanUrl)}
                  onRegenerateQr={() => handleRegenerateQr(selectedAsset, "selected")}
                  regeneratingQr={selectedAssetQrRegenerating}
                />

                <div className="divider-line" />
                <ActionFeedback
                  type={workflowFeedback.feedback?.type}
                  message={workflowFeedback.feedback?.message}
                  autoDismissMs={workflowFeedback.feedback?.autoDismissMs}
                  onClose={workflowFeedback.clear}
                  className="action-feedback-inline"
                />

                <form className="form-grid" onSubmit={submitAction}>
                  <fieldset
                    className="action-fieldset"
                    disabled={
                      !selectedAsset ||
                      !canPerformSelectedAction ||
                      !validActionOptions.length ||
                      (Boolean(selectedAssetId) && busyKey === `asset-action:${selectedAssetId}`)
                    }
                  >
                    <div
                    //  className="selected-asset-banner"
                     >
                      <strong>Action :- </strong>
                      <strong>{getAssetId(selectedAsset) || "No device selected"}</strong>
                    </div>

                    {!selectedAsset ? <div className="action-hint">Choose a device first. Actions apply only to the selected device.</div> : null}
                    {selectedAsset && !validActionOptions.length ? <div className="action-hint">No transitions are available for the current status.</div> : null}
                    {selectedAsset && !canPerformSelectedAction ? (
                      <div className="action-hint">You do not have UPDATE_ASSET permission for this action.</div>
                    ) : null}
                    {selectedAsset && validActionOptions.length && actionValidationError ? <div className="action-hint">{actionValidationError}</div> : null}

                    <select className="input" name="action" value={actionForm.action} onChange={handleActionChange} required>
                      {validActionOptions.length ? (
                        validActionOptions.map((action) => (
                          <option key={action} value={action}>
                            {getAssetActionLabel(action)}
                          </option>
                        ))
                      ) : (
                        <option value="">No valid actions</option>
                      )}
                    </select>
                    {renderActionFields({
                      action: actionForm.action,
                      actionForm,
                      handleActionChange,
                      selectedAsset,
                      setupData,
                    })}
                    <textarea className="input textarea" name="notes" placeholder="Reason (optional)" value={actionForm.notes} onChange={handleActionChange} />
                    <button
                      className="button dark button-rect with-spinner"
                      type="submit"
                      disabled={
                        !selectedAsset ||
                        !canPerformSelectedAction ||
                        !validActionOptions.length ||
                        !isActionFormValid ||
                        (Boolean(selectedAssetId) && busyKey === `asset-action:${selectedAssetId}`)
                      }
                    >
                      {Boolean(selectedAssetId) && busyKey === `asset-action:${selectedAssetId}` ? (
                        <span className="button-spinner button-spinner-lg" aria-hidden />
                      ) : null}
                      <span>
                        {Boolean(selectedAssetId) && busyKey === `asset-action:${selectedAssetId}` ? "Applying..." : "Apply Action"}
                      </span>
                    </button>
                  </fieldset>
                </form>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {editingAsset ? (
        <Modal
          title="Edit Asset"
          subtitle={`Update details for ${getAssetId(editingAsset)}`}
          onClose={() => setEditingAsset(null)}
          feedback={
            <ActionFeedback
              type={modalFeedback.feedback?.type}
              message={modalFeedback.feedback?.message}
              autoDismissMs={modalFeedback.feedback?.autoDismissMs}
              onClose={modalFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button
                className="button ghost button-rect"
                type="button"
                onClick={() => setEditingAsset(null)}
                disabled={busyKey === `edit-asset:${editingAsset._id}`}
              >
                Cancel
              </button>
              <button
                className="button dark button-rect with-spinner"
                type="button"
                onClick={submitEditAsset}
                disabled={!canUpdateAsset || busyKey === `edit-asset:${editingAsset._id}`}
              >
                {busyKey === `edit-asset:${editingAsset._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `edit-asset:${editingAsset._id}` ? "Saving..." : "Save"}</span>
              </button>
            </>
          }
        >
          <div className="form-grid wide-grid">
            <label className="field-stack">
              <span>SKU</span>
              <select className="input" value={editForm.productId} onChange={(event) => setEditForm((c) => ({ ...c, productId: event.target.value }))} required>
                <option value="">Select SKU</option>
                {setupData.products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.sku} - {product.brand} {product.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span>Serial Number</span>
              <input
                className="input"
                value={editForm.serialNumber}
                onChange={(event) => setEditForm((c) => ({ ...c, serialNumber: digitsOnly(event.target.value) }))}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </label>

            <label className="field-stack">
              <span>Location</span>
              <select
                className="input"
                value={editForm.locationType}
                onChange={(event) =>
                  setEditForm((c) => ({
                    ...c,
                    locationType: event.target.value,
                    locationId: event.target.value === "WFH" ? "" : c.locationId,
                    wfhAddress: event.target.value === "WFH" ? c.wfhAddress : "",
                  }))
                }
              >
                <option value="PHYSICAL">PHYSICAL</option>
                <option value="WFH">WFH</option>
              </select>
              {editForm.locationType === "WFH" ? (
                <textarea
                  className="input textarea"
                  placeholder="WFH Address"
                  value={editForm.wfhAddress}
                  onChange={(event) => setEditForm((c) => ({ ...c, wfhAddress: event.target.value }))}
                  required
                />
              ) : (
                <select className="input" value={editForm.locationId} onChange={(event) => setEditForm((c) => ({ ...c, locationId: event.target.value }))} required>
                  <option value="">Select location</option>
                  {setupData.locations.map((location) => (
                    <option key={location._id} value={location._id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="field-stack">
              <span>Assigned User</span>
              <select className="input" value={editForm.assignedToId} onChange={(event) => setEditForm((c) => ({ ...c, assignedToId: event.target.value }))}>
                <option value="">Unassigned</option>
                {setupData.users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span>Status</span>
              <select className="input" value={editForm.status} onChange={(event) => setEditForm((c) => ({ ...c, status: event.target.value }))} required>
                {getVisibleAssetStatuses().map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      ) : null}

      {deleteAssetTarget ? (
        <Modal
          title="Delete Asset"
          subtitle="Are you sure you want to delete this asset?"
          onClose={() => setDeleteAssetTarget(null)}
          feedback={
            <ActionFeedback
              type={modalFeedback.feedback?.type}
              message={modalFeedback.feedback?.message}
              autoDismissMs={modalFeedback.feedback?.autoDismissMs}
              onClose={modalFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button
                className="button ghost button-rect"
                type="button"
                onClick={() => setDeleteAssetTarget(null)}
                disabled={busyKey === `delete-asset:${deleteAssetTarget._id}`}
              >
                Cancel
              </button>
              <button
                className="button danger button-rect with-spinner"
                type="button"
                onClick={confirmDeleteAsset}
                disabled={!canDeleteAsset || busyKey === `delete-asset:${deleteAssetTarget._id}`}
              >
                {busyKey === `delete-asset:${deleteAssetTarget._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `delete-asset:${deleteAssetTarget._id}` ? "Deleting..." : "Delete"}</span>
              </button>
            </>
          }
        >
          <div className="page-stack">
            <p>
              You are deleting <strong>{getAssetId(deleteAssetTarget)}</strong>.
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

