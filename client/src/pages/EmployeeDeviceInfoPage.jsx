import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getMyAssets } from "../api/inventory";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

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

export function getEmployeeDeviceName(asset) {
  const brand = String(asset?.product?.brand || "").trim();
  const model = String(asset?.product?.model || "").trim();
  const combined = [brand, model].filter(Boolean).join(" ");
  return combined || asset?.assetId || "Device";
}

function getEventType(log) {
  const action = String(log?.action || "").toLowerCase();
  if (action.includes("assign")) return "Assign";
  if (action.includes("transfer") || action.includes("move")) return "Transfer";
  if (log?.fromStatus || log?.toStatus) return "Status";
  return "Update";
}

export function sortEmployeeDeviceLogs(logs = []) {
  return [...logs].sort((left, right) => {
    const leftTime = new Date(left?.timestamp || left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.timestamp || right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildEventSummary(log) {
  const fragments = [];

  if (log?.fromStatus || log?.toStatus) {
    fragments.push(`Status: ${log?.fromStatus || "-"} to ${log?.toStatus || "-"}`);
  }

  if (log?.fromLocation?.name || log?.toLocation?.name) {
    fragments.push(`Location: ${log?.fromLocation?.name || "-"} to ${log?.toLocation?.name || "-"}`);
  }

  if (log?.fromAssignee || log?.toAssignee) {
    fragments.push(`Assignee: ${formatUser(log?.fromAssignee)} to ${formatUser(log?.toAssignee)}`);
  }

  return fragments;
}

export function EmployeeDeviceTimelineEvent({ event, isLatest }) {
  const summary = buildEventSummary(event);

  return (
    <article className={`device-info-history-item employee-device-history-item${isLatest ? " is-latest" : ""}`}>
      <div className="device-info-timeline-header">
        <div className="device-info-history-heading">
          <strong className="device-info-timeline-type">{getEventType(event)}</strong>
          <strong className="device-info-history-action">{formatActionLabel(event?.action) || "Update"}</strong>
        </div>
        <span className="table-subtle">{formatTimestamp(event?.timestamp || event?.createdAt)}</span>
      </div>

      <div className="employee-device-history-meta">
        <div className="device-info-kv">
          <span>Performed By</span>
          <strong>{formatUser(event?.performedBy)}</strong>
        </div>
        {event?.reason ? (
          <div className="device-info-kv">
            <span>Reason</span>
            <strong>{event.reason}</strong>
          </div>
        ) : null}
      </div>

      {summary.length ? (
        <div className="employee-device-history-summary">
          {summary.map((item) => (
            <div key={item} className="employee-device-history-summary-item">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function EmployeeDeviceInfoPage() {
  const { assetId: routeAssetId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      setError("");

      try {
        const result = await getMyAssets();
        if (!cancelled) {
          setAssets(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load your assigned devices.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestedAssetId = String(searchParams.get("assetId") || routeAssetId || "").trim().toUpperCase();
    if (!requestedAssetId || loading || !assets.length) return;

    const matchedAsset = assets.find(
      (asset) => String(asset?.assetId || "").trim().toUpperCase() === requestedAssetId
    );

    if (matchedAsset) {
      openAssetDetails(matchedAsset);
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("assetId");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, assets, loading, routeAssetId]);

  async function openAssetDetails(asset) {
    setDetailsLoading(true);
    setSelectedAsset({
      ...asset,
      recentAuditLogs: [],
    });
    setError("");

    try {
      const result = await getMyAssets({
        includeAuditLogs: true,
        auditLogLimit: 20,
      });

      const detailedAsset = Array.isArray(result)
        ? result.find((item) => String(item?._id) === String(asset?._id))
        : null;

      setSelectedAsset(
        detailedAsset
          ? {
              ...detailedAsset,
              recentAuditLogs: sortEmployeeDeviceLogs(detailedAsset.recentAuditLogs || []),
            }
          : {
              ...asset,
              recentAuditLogs: [],
            }
      );
    } catch (err) {
      setError(err.message || "Unable to load device history.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeModal() {
    setSelectedAsset(null);
    setDetailsLoading(false);
  }

  return (
    <div className="page-stack">
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard
        title="Device Info"
        subtitle="View the devices currently assigned to you and review their recent activity."
        actions={<span className="role-chip">EMPLOYEE</span>}
      >
        <div className="employee-device-intro">
          <div>
            <strong>Your Assigned Devices</strong>
            <p className="table-subtle">Select any device to open its history timeline.</p>
          </div>
          <div className="employee-device-count">{loading ? "Loading..." : `${assets.length} device${assets.length === 1 ? "" : "s"}`}</div>
        </div>

        {loading ? (
          <div className="page-message">Loading your assigned devices...</div>
        ) : assets.length ? (
          <div className="employee-device-grid">
            {assets.map((asset) => (
              <button
                key={asset._id}
                type="button"
                className="employee-device-card"
                onClick={() => openAssetDetails(asset)}
              >
                <div className="employee-device-card-top">
                  <div>
                    <strong className="employee-device-name">{getEmployeeDeviceName(asset)}</strong>
                    <div className="table-subtle">{asset.assetId || "Unknown asset"}</div>
                  </div>
                  <StatusPill status={asset.status} />
                </div>

                <div className="employee-device-card-details">
                  <div className="device-info-kv">
                    <span>SKU</span>
                    <strong>{asset.product?.sku || "-"}</strong>
                  </div>
                  <div className="device-info-kv">
                    <span>Location</span>
                    <strong>{asset.location?.name || "-"}</strong>
                  </div>
                  <div className="device-info-kv">
                    <span>Status</span>
                    <strong>{asset.status || "-"}</strong>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">No devices are currently assigned to you.</div>
        )}
      </SectionCard>

      {selectedAsset ? (
        <Modal
          className="device-info-modal employee-device-modal"
          title={getEmployeeDeviceName(selectedAsset)}
          subtitle={selectedAsset.assetId ? `History for ${selectedAsset.assetId}` : "Assigned device history"}
          onClose={closeModal}
          actions={
            <button className="button ghost button-rect" type="button" onClick={closeModal}>
              Close
            </button>
          }
        >
          <div className="device-info-modal-grid employee-device-modal-grid">
            <div className="device-info-panel">
              <strong className="device-info-panel-title">Assigned Device</strong>
              <div className="device-info-kv">
                <span>Device Name</span>
                <strong>{getEmployeeDeviceName(selectedAsset)}</strong>
              </div>
              <div className="device-info-kv">
                <span>SKU</span>
                <strong>{selectedAsset.product?.sku || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Location</span>
                <strong>{selectedAsset.location?.name || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Status</span>
                <strong>{selectedAsset.status || "-"}</strong>
              </div>
            </div>

            <div className="device-info-panel device-info-history-panel">
              <div className="device-info-history-panel-header">
                <div>
                  <strong className="device-info-panel-title">Timeline</strong>
                  <div className="table-subtle">Assignment, transfer, and status activity for this device.</div>
                </div>
              </div>

              {detailsLoading ? (
                <div className="page-message">Loading device history...</div>
              ) : selectedAsset.recentAuditLogs?.length ? (
                <div className="device-info-history-scroll">
                  <div className="device-info-timeline">
                    {selectedAsset.recentAuditLogs.map((event, index) => (
                      <EmployeeDeviceTimelineEvent
                        key={`${event._id || event.action || "event"}:${event.timestamp || event.createdAt || index}`}
                        event={event}
                        isLatest={index === 0}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">No history available for this device yet.</div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
