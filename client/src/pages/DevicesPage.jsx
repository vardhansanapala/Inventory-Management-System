import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssetAuditLogs, getAssignedDevices } from "../api/inventory";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { getDisplayAssetStatus } from "../constants/assetWorkflow";
import { useAuth } from "../context/AuthContext";
import { getAssetId, getAssetLocationLabel, getAssetWfhAddress, isWfhLocation } from "../utils/asset.util";
import { getFullDateTime, getLastUpdatedValue, getRelativeTime, getSortableTime } from "../utils/date.util";
import {
  EmployeeDeviceTimelineEvent,
  getEmployeeDeviceName,
  sortEmployeeDeviceLogs,
} from "./EmployeeDeviceInfoPage";

const ASSIGNED_STATUS = "ASSIGNED";

function formatOwnerName(user) {
  if (!user) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "-";
}

function getLocationName(asset) {
  return getAssetLocationLabel(asset);
}

function getAssetSearchText(asset) {
  return [
    getAssetId(asset),
    asset?.product?.sku,
    formatOwnerName(asset?.assignedTo),
    asset?.assignedTo?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function DevicesPage() {
  const { user: currentUser } = useAuth();

  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [, forceRelativeRefresh] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState("ALL");
  const [selectedLocationId, setSelectedLocationId] = useState("ALL");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const debounceRef = useRef(null);
  const previousSearchRef = useRef("");
  const lastHistoryAssetIdRef = useRef("");

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const next = searchInput.trim().toLowerCase();
      if (previousSearchRef.current !== next) {
        previousSearchRef.current = next;
        setSearch(next);
      }
    }, 300);

    return () => window.clearTimeout(debounceRef.current);
  }, [searchInput]);

  useEffect(() => {
    const id = window.setInterval(() => {
      forceRelativeRefresh((value) => value + 1);
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  const loadAssignedDevices = useCallback(async () => {
    setListLoading(true);
    setError("");

    try {
      const data = await getAssignedDevices();
      const assignedAssets = (Array.isArray(data) ? data : [])
        .filter((asset) => asset?.status === ASSIGNED_STATUS)
        .map((asset) => ({
          ...asset,
          assignedTo: asset?.assignedTo || currentUser,
        }));

      setAssets(assignedAssets);
      setUsers(
        Array.from(
          new Map(
            assignedAssets
              .filter((asset) => asset?.assignedTo?._id)
              .map((asset) => [asset.assignedTo._id, asset.assignedTo])
          ).values()
        )
      );
      setLocations(
        Array.from(
          new Map(
            assignedAssets
              .filter((asset) => asset?.location?._id)
              .map((asset) => [asset.location._id, asset.location])
          ).values()
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load devices.");
      setAssets([]);
      setUsers([]);
      setLocations([]);
    } finally {
      setListLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadAssignedDevices();
  }, [loadAssignedDevices]);

  const filteredAssets = useMemo(() => {
    const searchFiltered = search
      ? assets.filter((asset) => getAssetSearchText(asset).includes(search))
      : assets;

    const userFiltered = selectedUserId === "ALL"
      ? searchFiltered
      : searchFiltered.filter((asset) => String(asset?.assignedTo?._id || "") === selectedUserId);

    const locationFiltered = selectedLocationId === "ALL"
      ? userFiltered
      : userFiltered.filter((asset) => String(asset?.location?._id || "") === selectedLocationId);

    return [...locationFiltered].sort((left, right) => {
      const leftTime = getSortableTime(getLastUpdatedValue(left));
      const rightTime = getSortableTime(getLastUpdatedValue(right));
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [assets, search, selectedLocationId, selectedUserId, sort]);

  useEffect(() => {
    const id = selectedAsset?._id;
    if (!id) {
      setHistory([]);
      setHistoryError("");
      setHistoryLoading(false);
      lastHistoryAssetIdRef.current = "";
      return;
    }

    if (lastHistoryAssetIdRef.current === String(id)) {
      return;
    }
    lastHistoryAssetIdRef.current = String(id);

    let cancelled = false;

    async function run() {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const logs = await getAssetAuditLogs(id);
        if (!cancelled) {
          setHistory(sortEmployeeDeviceLogs(Array.isArray(logs) ? logs : []));
        }
      } catch (err) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(err.message || "Unable to load history.");
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedAsset?._id]);

  const subtitle = "A flat view of all assigned devices with quick filtering by user and location.";

  return (
    <div className="devices-page page-stack">
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard title="Assigned Devices" subtitle={subtitle}>
        <div className="devices-toolbar devices-toolbar-flat">
          <input
            className="input"
            placeholder="Search by asset ID, SKU, or user..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search assigned devices"
          />
          <label className="field-stack devices-filter-field">
            <span>Sort</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          <label className="field-stack devices-filter-field">
            <span>User</span>
            <select className="input" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              <option value="ALL">ALL</option>
              {users.map((targetUser) => (
                <option key={targetUser._id} value={targetUser._id}>
                  {formatOwnerName(targetUser)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack devices-filter-field">
            <span>Location</span>
            <select className="input" value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
              <option value="ALL">ALL</option>
              {locations.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          {listLoading ? <span className="table-subtle">Loading...</span> : null}
        </div>

        {listLoading ? (
          <div className="page-message">Loading assigned devices...</div>
        ) : (
          <div className="table-wrap">
            <table className="table devices-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>SKU</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length ? (
                  filteredAssets.map((asset) => (
                    <tr
                      key={asset._id}
                      className={(() => {
                        const updatedTime = getSortableTime(getLastUpdatedValue(asset));
                        return ["devices-row", updatedTime && Date.now() - updatedTime <= 5 * 60 * 1000 ? "row-recent" : ""].join(" ").trim();
                      })()}
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <td>
                        <strong>{getAssetId(asset) || "-"}</strong>
                      </td>
                      <td>{asset.product?.sku || "-"}</td>
                      <td>{formatOwnerName(asset.assignedTo)}</td>
                      <td>{getLocationName(asset)}</td>
                      <td>
                        <StatusPill status={asset.status} />
                      </td>
                      <td className="table-date">
                        <span title={getFullDateTime(getLastUpdatedValue(asset))}>
                          {getRelativeTime(getLastUpdatedValue(asset))}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>{search || selectedUserId !== "ALL" || selectedLocationId !== "ALL" ? "No assigned devices match your filters." : "No assigned devices found."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selectedAsset ? (
        <Modal
          className="device-info-modal employee-device-modal devices-detail-modal"
          title={getEmployeeDeviceName(selectedAsset)}
          subtitle={selectedAsset.assetId ? `History for ${selectedAsset.assetId}` : "Assigned device history"}
          onClose={() => setSelectedAsset(null)}
          actions={
            <button className="button ghost button-rect" type="button" onClick={() => setSelectedAsset(null)}>
              Close
            </button>
          }
        >
          <div className="device-info-modal-grid employee-device-modal-grid">
            <div className="device-info-panel">
              <strong className="device-info-panel-title">Device Details</strong>
              <div className="device-info-kv">
                <span>Asset ID</span>
                <strong>{getAssetId(selectedAsset) || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Device Name</span>
                <strong>{getEmployeeDeviceName(selectedAsset)}</strong>
              </div>
              <div className="device-info-kv">
                <span>SKU</span>
                <strong>{selectedAsset.product?.sku || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Assigned User</span>
                <strong>{formatOwnerName(selectedAsset.assignedTo)}</strong>
              </div>
              <div className="device-info-kv">
                <span>Location</span>
                <strong>{getLocationName(selectedAsset)}</strong>
              </div>
              {isWfhLocation(selectedAsset) ? (
                <div className="device-info-kv">
                  <span>Address</span>
                  <strong>{getAssetWfhAddress(selectedAsset) || "-"}</strong>
                </div>
              ) : null}
              <div className="device-info-kv">
                <span>Status</span>
                <strong>{getDisplayAssetStatus(selectedAsset.status)}</strong>
              </div>
            </div>

            <div className="device-info-panel device-info-history-panel">
              <div className="device-info-history-panel-header">
                <div>
                  <strong className="device-info-panel-title">Timeline</strong>
                  <div className="table-subtle">Full audit history for this assigned device.</div>
                </div>
              </div>

              {historyError ? <div className="page-message error">{historyError}</div> : null}
              {historyLoading ? <div className="page-message">Loading device history...</div> : null}

              {!historyLoading && history.length ? (
                <div className="device-info-history-scroll devices-modal-history-scroll">
                  <div className="device-info-timeline">
                    {history.map((event, index) => (
                      <EmployeeDeviceTimelineEvent
                        key={`${event._id || event.action || "event"}:${event.timestamp || event.createdAt || index}`}
                        event={event}
                        isLatest={index === 0}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {!historyLoading && !history.length && !historyError ? (
                <div className="empty-state">No history available for this device yet.</div>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
