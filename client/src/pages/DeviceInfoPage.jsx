import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getAssetById, getAssetDetails, getAssets } from "../api/inventory";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { getDisplayAssetStatus } from "../constants/assetWorkflow";
import { getAssetLocationLabel, getAssetWfhAddress, isWfhLocation } from "../utils/asset.util";

const HISTORY_PREVIEW_COUNT = 5;

function formatUser(user) {
  if (!user) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "-";
}

function formatActionLabel(action) {
  return String(action || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function sortHistoryEntries(history = []) {
  return [...history].sort((left, right) => {
    const leftTime = new Date(left?.timestamp || 0).getTime();
    const rightTime = new Date(right?.timestamp || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildChangeRows(event) {
  const rows = [];

  if (event.from?.status || event.to?.status) {
    rows.push({
      label: "Status",
      from: getDisplayAssetStatus(event.from?.status),
      to: getDisplayAssetStatus(event.to?.status),
    });
  }

  if (event.fromLocation || event.toLocation) {
    rows.push({
      label: "Location",
      from: event.fromLocation?.name || "-",
      to: event.toLocation?.name || "-",
    });
  }

  if (event.fromAssignee || event.toAssignee) {
    rows.push({
      label: "Assignee",
      from: formatUser(event.fromAssignee),
      to: formatUser(event.toAssignee),
    });
  }

  return rows;
}

function HistoryEvent({ event, isLatest = false }) {
  const changes = buildChangeRows(event);

  return (
    <article className={`device-info-history-item${isLatest ? " is-latest" : ""}`}>
      <div className="device-info-timeline-header">
        <div className="device-info-history-heading">
          <strong className="device-info-timeline-type">{event.type}</strong>
          <strong className="device-info-history-action">{formatActionLabel(event.action) || event.type}</strong>
          {isLatest ? <span className="device-info-history-latest">Latest action</span> : null}
        </div>
        <span className="table-subtle">{formatTimestamp(event.timestamp)}</span>
      </div>

      <div className="device-info-history-meta">
        <div className="device-info-kv">
          <span>User</span>
          <strong>{formatUser(event.user)}</strong>
        </div>
        {event.reason ? (
          <div className="device-info-kv">
            <span>Reason</span>
            <strong>{event.reason}</strong>
          </div>
        ) : null}
        {event.description ? (
          <div className="device-info-kv">
            <span>Details</span>
            <strong>{event.description}</strong>
          </div>
        ) : null}
      </div>

      {changes.length ? (
        <div className="device-info-history-changes">
          <span className="device-info-history-section-label">Changes</span>
          <div className="device-info-history-change-list">
            {changes.map((change) => (
              <div key={change.label} className="device-info-history-change-row">
                <span>{change.label}</span>
                <strong>
                  {change.from} to {change.to}
                </strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function DeviceInfoPage() {
  const { assetId: routeAssetId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedAssetDetails, setSelectedAssetDetails] = useState(null);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const debounceRef = useRef(null);
  const previousSearchRef = useRef("");

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (previousSearchRef.current !== nextSearch) {
        previousSearchRef.current = nextSearch;
        setPage(1);
        setSearch(nextSearch);
      }
    }, 300);

    return () => window.clearTimeout(debounceRef.current);
  }, [searchInput]);

  const pageLabel = useMemo(() => {
    const safeTotalPages = Math.max(totalPages || 1, 1);
    const safePage = Math.min(Math.max(page, 1), safeTotalPages);
    return `Page ${safePage} of ${safeTotalPages}`;
  }, [page, totalPages]);

  const hasHiddenHistory = selectedAssetHistory.length > HISTORY_PREVIEW_COUNT;
  const visibleHistory = historyExpanded ? selectedAssetHistory : selectedAssetHistory.slice(0, HISTORY_PREVIEW_COUNT);

  async function fetchAssets() {
    setLoading(true);
    setError("");
    try {
      const result = await getAssets({ page, limit, search });
      setAssets(Array.isArray(result?.data) ? result.data : []);
      setTotal(Number(result?.total) || 0);
      setTotalPages(Number(result?.totalPages) || 1);
    } catch (err) {
      setError(err.message || "Unable to load assets.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    fetchAssets();
  }, [page, search]);

  useEffect(() => {
    const requestedAssetId = String(searchParams.get("assetId") || routeAssetId || "").trim();
    if (!requestedAssetId) return;

    let isCancelled = false;

    async function consumeAssetIdFromUrl() {
      try {
        const asset = await getAssetById(requestedAssetId);
        if (!isCancelled && asset) {
          await openDetails(asset);
        }
      } finally {
        if (!isCancelled) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete("assetId");
            return next;
          }, { replace: true });
        }
      }
    }

    consumeAssetIdFromUrl();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, setSearchParams, routeAssetId]);

  async function openDetails(asset) {
    const assetId = asset?._id || asset?.assetId;
    if (!assetId) return;

    setSelectedAssetId(assetId);
    setSelectedAssetDetails(null);
    setSelectedAssetHistory([]);
    setHistoryExpanded(false);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setError("");

    try {
      const result = await getAssetDetails(assetId);
      setSelectedAssetDetails(result?.asset || null);
      setSelectedAssetHistory(sortHistoryEntries(Array.isArray(result?.history) ? result.history : []));
    } catch (err) {
      setError(err.message || "Unable to load asset details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    setDetailsOpen(false);
    setSelectedAssetId("");
    setSelectedAssetDetails(null);
    setSelectedAssetHistory([]);
    setHistoryExpanded(false);
    setDetailsLoading(false);
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="page-stack">
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard
        title="Device Info"
        subtitle="Super-admin visibility into all devices, with searchable registry and detailed history."
        actions={<span className="role-chip">SUPER ADMIN</span>}
      >
        <div className="device-info-toolbar">
          <input
            className="input"
            placeholder="Search by Asset Id or SKU or Serial Number"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <div className="device-info-pagination">
            <span className="table-subtle">
              {pageLabel} | {total} devices{loading ? " | Loading..." : ""}
            </span>
            <div className="inline-form">
              <button className="button ghost button-rect" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev}>
                Previous
              </button>
              <button className="button ghost button-rect" type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canNext}>
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table device-info-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>SKU</th>
                <th>Status</th>
                <th>Location</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr>
                  <td colSpan={6}>Loading devices...</td>
                </tr>
              ) : assets.length ? (
                assets.map((asset) => (
                  <tr key={asset._id} onClick={() => openDetails(asset)} className="device-info-row">
                    <td>
                      <strong>{asset.assetId}</strong>
                      <div className="table-subtle">{asset.serialNumber || "No serial"}</div>
                    </td>
                    <td>{asset.product?.sku || "-"}</td>
                    <td>
                      <StatusPill status={asset.status} />
                    </td>
                    <td>{getAssetLocationLabel(asset)}</td>
                    <td>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button className="button ghost button-rect button-sm" type="button" onClick={() => openDetails(asset)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No results found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {detailsOpen ? (
        <Modal
          className="device-info-modal"
          title="Device Details"
          subtitle={selectedAssetDetails?.assetId ? `History for ${selectedAssetDetails.assetId}` : selectedAssetId ? `Loading ${selectedAssetId}...` : ""}
          onClose={closeDetails}
          actions={
            <button className="button ghost button-rect" type="button" onClick={closeDetails}>
              Close
            </button>
          }
        >
          {detailsLoading ? <div className="page-message">Loading details...</div> : null}

          {selectedAssetDetails ? (
            <div className="device-info-modal-grid">
              <div className="device-info-panel">
                <strong className="device-info-panel-title">Device Info</strong>
                <div className="device-info-kv">
                  <span>Asset ID</span>
                  <strong>{selectedAssetDetails.assetId}</strong>
                </div>
                <div className="device-info-kv">
                  <span>SKU</span>
                  <strong>{selectedAssetDetails.sku || "-"}</strong>
                </div>
                <div className="device-info-kv">
                  <span>Serial Number</span>
                  <strong>{selectedAssetDetails.serialNumber || "-"}</strong>
                </div>
                <div className="device-info-kv">
                  <span>Status</span>
                  <strong>{getDisplayAssetStatus(selectedAssetDetails.status)}</strong>
                </div>
                <div className="device-info-kv">
                  <span>Location</span>
                  <strong>{getAssetLocationLabel(selectedAssetDetails)}</strong>
                </div>
                {isWfhLocation(selectedAssetDetails) ? (
                  <div className="device-info-kv">
                    <span>Address</span>
                    <strong>{getAssetWfhAddress(selectedAssetDetails) || "-"}</strong>
                  </div>
                ) : null}
                <div className="device-info-kv">
                  <span>Assigned User</span>
                  <strong>{formatUser(selectedAssetDetails.assignedTo)}</strong>
                </div>
              </div>

              <div className="device-info-panel device-info-history-panel">
                <div className="device-info-history-panel-header">
                  <div>
                    <strong className="device-info-panel-title">History</strong>
                    <div className="table-subtle">
                      Showing {visibleHistory.length} of {selectedAssetHistory.length} records
                    </div>
                  </div>
                  {hasHiddenHistory ? (
                    <button
                      className="button ghost button-rect button-sm"
                      type="button"
                      onClick={() => setHistoryExpanded((current) => !current)}
                    >
                      {historyExpanded ? "Show Less" : "Show Full History"}
                    </button>
                  ) : null}
                </div>

                {selectedAssetHistory.length ? (
                  <div className="device-info-history-scroll">
                    <div className="device-info-timeline">
                      {visibleHistory.map((event, idx) => (
                        <HistoryEvent
                          key={`${event.action || "event"}:${event.timestamp || idx}`}
                          event={event}
                          isLatest={idx === 0}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">No history found for this device.</div>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
