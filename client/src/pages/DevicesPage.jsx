import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAssetAuditLogs, getAssetsBootstrap, getAssetsByUser, getMyAssets } from "../api/inventory";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { getAssetId } from "../utils/asset.util";
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
  return asset?.location?.name || "-";
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
  const isEmployee = currentUser?.role === ROLES.EMPLOYEE;

  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
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

  const loadAssignedDevices = useCallback(async () => {
    setListLoading(true);
    setError("");

    try {
      if (isEmployee) {
        const data = await getMyAssets();
        const assignedAssets = (Array.isArray(data) ? data : [])
          .filter((asset) => asset?.status === ASSIGNED_STATUS)
          .map((asset) => ({
            ...asset,
            assignedTo: asset?.assignedTo || currentUser,
          }));

        setAssets(assignedAssets);
        setUsers(currentUser ? [currentUser] : []);
        setLocations(
          Array.from(
            new Map(
              assignedAssets
                .filter((asset) => asset?.location?._id)
                .map((asset) => [asset.location._id, asset.location])
            ).values()
          )
        );
        return;
      }

      const bootstrap = await getAssetsBootstrap();
      const bootstrapUsers = Array.isArray(bootstrap?.users) ? bootstrap.users : [];
      const bootstrapLocations = Array.isArray(bootstrap?.locations) ? bootstrap.locations : [];

      const pairs = await Promise.all(
        bootstrapUsers.map(async (targetUser) => {
          try {
            const userAssets = await getAssetsByUser(targetUser._id);
            return (Array.isArray(userAssets) ? userAssets : [])
              .filter((asset) => asset?.status === ASSIGNED_STATUS)
              .map((asset) => ({
                ...asset,
                assignedTo: asset?.assignedTo || targetUser,
              }));
          } catch {
            return [];
          }
        })
      );

      setAssets(pairs.flat());
      setUsers(bootstrapUsers);
      setLocations(bootstrapLocations);
    } catch (err) {
      setError(err.message || "Unable to load devices.");
      setAssets([]);
      setUsers([]);
      setLocations([]);
    } finally {
      setListLoading(false);
    }
  }, [currentUser, isEmployee]);

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
      const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
      const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [assets, search, selectedLocationId, selectedUserId]);

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

  const subtitle = isEmployee
    ? "Assigned devices in one searchable list."
    : "A flat view of all assigned devices with quick filtering by user and location.";

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
          {!isEmployee ? (
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
          ) : null}
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
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length ? (
                  filteredAssets.map((asset) => (
                    <tr key={asset._id} className="devices-row" onClick={() => setSelectedAsset(asset)}>
                      <td>
                        <strong>{getAssetId(asset) || "-"}</strong>
                      </td>
                      <td>{asset.product?.sku || "-"}</td>
                      <td>{formatOwnerName(asset.assignedTo)}</td>
                      <td>{getLocationName(asset)}</td>
                      <td>
                        <StatusPill status={asset.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>{search || selectedUserId !== "ALL" || selectedLocationId !== "ALL" ? "No assigned devices match your filters." : "No assigned devices found."}</td>
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
              <div className="device-info-kv">
                <span>Status</span>
                <strong>{selectedAsset.status || "-"}</strong>
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
