import { useEffect, useMemo, useRef, useState } from "react";
import { getAssetDetails, getAssets } from "../api/inventory";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

function formatUser(user) {
  if (!user) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "-";
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function HistoryEvent({ event }) {
  return (
    <div className="device-info-timeline-card">
      <div className="device-info-timeline-header">
        <strong className="device-info-timeline-type">{event.type}</strong>
        <span className="table-subtle">{formatTimestamp(event.timestamp)}</span>
      </div>
      <div className="device-info-timeline-body">
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
        {event.fromAssignee || event.toAssignee ? (
          <div className="device-info-kv">
            <span>Assignee</span>
            <strong>
              {formatUser(event.fromAssignee)} → {formatUser(event.toAssignee)}
            </strong>
          </div>
        ) : null}
        {event.fromLocation || event.toLocation ? (
          <div className="device-info-kv">
            <span>Location</span>
            <strong>
              {event.fromLocation?.name || "-"} → {event.toLocation?.name || "-"}
            </strong>
          </div>
        ) : null}
        {event.from?.status || event.to?.status ? (
          <div className="device-info-kv">
            <span>Status</span>
            <strong>
              {event.from?.status || "-"} → {event.to?.status || "-"}
            </strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeviceInfoPage() {
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

  async function openDetails(asset) {
    const assetId = asset?._id || asset?.assetId;
    if (!assetId) return;

    setSelectedAssetId(assetId);
    setSelectedAssetDetails(null);
    setSelectedAssetHistory([]);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setError("");

    try {
      const result = await getAssetDetails(assetId);
      setSelectedAssetDetails(result?.asset || null);
      setSelectedAssetHistory(Array.isArray(result?.history) ? result.history : []);
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
            placeholder="Search by Asset ID or device name"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <div className="device-info-pagination">
            <span className="table-subtle">
              {pageLabel} · {total} devices{loading ? " · Loading..." : ""}
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
                    <td>{asset.location?.name || "-"}</td>
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
                  <td colSpan={6}>No assets found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {detailsOpen ? (
        <Modal
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
                  <strong>{selectedAssetDetails.status}</strong>
                </div>
                <div className="device-info-kv">
                  <span>Location</span>
                  <strong>{selectedAssetDetails.location?.name || "-"}</strong>
                </div>
                <div className="device-info-kv">
                  <span>Assigned User</span>
                  <strong>{formatUser(selectedAssetDetails.assignedTo)}</strong>
                </div>
              </div>

              <div className="device-info-panel">
                <strong className="device-info-panel-title">History</strong>
                {selectedAssetHistory.length ? (
                  <div className="device-info-timeline">
                    {selectedAssetHistory.map((event, idx) => (
                      <HistoryEvent key={`${event.action || "event"}:${event.timestamp || idx}`} event={event} />
                    ))}
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

