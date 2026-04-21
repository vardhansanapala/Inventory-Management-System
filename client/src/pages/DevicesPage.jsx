import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAssetAuditLogs, getAssetsBootstrap, getAssetsByUser, getMyAssets } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { PERMISSIONS, hasPermission } from "../constants/permissions";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { getAssetId } from "../utils/asset.util";
import {
  EmployeeDeviceTimelineEvent,
  getEmployeeDeviceName,
  sortEmployeeDeviceLogs,
} from "./EmployeeDeviceInfoPage";

function formatOwnerName(user) {
  if (!user) return "";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "";
}

function assetSearchText(asset) {
  return [
    getAssetId(asset),
    asset?.serialNumber,
    asset?.product?.sku,
    asset?.product?.brand,
    asset?.product?.model,
    asset?.status,
    asset?.location?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(asset, ownerUser, q) {
  if (!q) return true;
  const owner = formatOwnerName(ownerUser).toLowerCase();
  const email = String(ownerUser?.email || "").toLowerCase();
  return owner.includes(q) || email.includes(q) || assetSearchText(asset).includes(q);
}

export function DevicesPage() {
  const { user: currentUser } = useAuth();
  const role = currentUser?.role;
  const isEmployee = role === ROLES.EMPLOYEE;

  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeAssets, setEmployeeAssets] = useState([]);
  const [adminGroups, setAdminGroups] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef(null);
  const previousSearchRef = useRef("");

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const lastHistoryAssetIdRef = useRef("");

  const canShowAssetActions =
    !isEmployee &&
    (hasPermission(currentUser, PERMISSIONS.ASSIGN_ASSET) || hasPermission(currentUser, PERMISSIONS.UPDATE_ASSET));

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

  const loadLists = useCallback(async () => {
    setListLoading(true);
    setError("");

    try {
      if (isEmployee) {
        const data = await getMyAssets();
        setEmployeeAssets(Array.isArray(data) ? data : []);
        setAdminGroups([]);
        return;
      }

      const bootstrap = await getAssetsBootstrap();
      const users = Array.isArray(bootstrap?.users) ? bootstrap.users : [];
      const pairs = await Promise.all(
        users.map(async (u) => {
          try {
            const assets = await getAssetsByUser(u._id);
            return { user: u, assets: Array.isArray(assets) ? assets : [] };
          } catch {
            return { user: u, assets: [] };
          }
        })
      );
      setAdminGroups(pairs.filter((p) => p.assets.length > 0));
      setEmployeeAssets([]);
    } catch (err) {
      setError(err.message || "Unable to load devices.");
      setEmployeeAssets([]);
      setAdminGroups([]);
    } finally {
      setListLoading(false);
    }
  }, [isEmployee]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const filteredEmployeeAssets = useMemo(() => {
    if (!isEmployee) return [];
    const q = search;
    return employeeAssets.filter((asset) => matchesQuery(asset, currentUser, q));
  }, [isEmployee, employeeAssets, search, currentUser]);

  const filteredAdminGroups = useMemo(() => {
    if (isEmployee) return [];
    const q = search;
    return adminGroups
      .map(({ user, assets }) => {
        const nextAssets = assets.filter((asset) => matchesQuery(asset, user, q));
        return { user, assets: nextAssets };
      })
      .filter((g) => g.assets.length > 0);
  }, [isEmployee, adminGroups, search]);

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

  function selectAsset(asset, ownerUser) {
    setSelectedAsset(asset);
    setSelectedOwner(ownerUser || null);
    lastHistoryAssetIdRef.current = "";
  }

  const subtitle = isEmployee
    ? "Devices assigned to you. Search and open details in the side panel."
    : "Devices grouped by assignee. Search by user or device, then review full history in the panel.";

  return (
    <div className="devices-page page-stack">
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard title="Devices" subtitle={subtitle} />

      <div className="devices-split">
        <section className="devices-pane section-card">
          <div className="devices-toolbar">
            <input
              className="input"
              placeholder={isEmployee ? "Search by name, asset ID, or SKU…" : "Search by user name, asset ID, or SKU…"}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search devices"
            />
            {listLoading ? <span className="table-subtle">Loading…</span> : null}
          </div>

          {listLoading ? (
            <div className="page-message">Loading devices…</div>
          ) : isEmployee ? (
            <div className="table-wrap">
              <table className="table devices-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployeeAssets.length ? (
                    filteredEmployeeAssets.map((asset) => {
                      const active = String(selectedAsset?._id) === String(asset._id);
                      return (
                        <tr
                          key={asset._id}
                          className={active ? "devices-row is-active" : "devices-row"}
                          onClick={() => selectAsset(asset, currentUser)}
                        >
                          <td>
                            <strong>{getEmployeeDeviceName(asset)}</strong>
                            <div className="table-subtle">{getAssetId(asset)}</div>
                          </td>
                          <td>{asset.product?.sku || "-"}</td>
                          <td>{asset.location?.name || "-"}</td>
                          <td>
                            <StatusPill status={asset.status} />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4}>{search ? "No devices match your search." : "No devices assigned to you."}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="devices-grouped">
              {filteredAdminGroups.length ? (
                filteredAdminGroups.map(({ user, assets }) => (
                  <div key={user._id} className="devices-user-group">
                    <div className="devices-user-heading">
                      <strong>{formatOwnerName(user) || "User"}</strong>
                      <span className="table-subtle">{assets.length} device{assets.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="table-wrap">
                      <table className="table devices-table">
                        <thead>
                          <tr>
                            <th>Device</th>
                            <th>SKU</th>
                            <th>Location</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset) => {
                            const active = String(selectedAsset?._id) === String(asset._id);
                            return (
                              <tr
                                key={asset._id}
                                className={active ? "devices-row is-active" : "devices-row"}
                                onClick={() => selectAsset(asset, user)}
                              >
                                <td>
                                  <strong>{getEmployeeDeviceName(asset)}</strong>
                                  <div className="table-subtle">{getAssetId(asset)}</div>
                                </td>
                                <td>{asset.product?.sku || "-"}</td>
                                <td>{asset.location?.name || "-"}</td>
                                <td>
                                  <StatusPill status={asset.status} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  {search ? "No devices match your search." : "No assigned devices found."}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="devices-pane section-card devices-detail-pane">
          {!selectedAsset ? (
            <div className="empty-state">Select a device to view details and full history.</div>
          ) : (
            <>
              <div className="devices-detail-header">
                <div>
                  <h3 className="devices-detail-title">{getEmployeeDeviceName(selectedAsset)}</h3>
                  <p className="table-subtle">
                    {getAssetId(selectedAsset)}
                    {selectedOwner ? ` · ${formatOwnerName(selectedOwner)}` : null}
                  </p>
                </div>
                {canShowAssetActions ? (
                  <Link className="button dark button-rect button-sm" to={`/assign-device?assetId=${encodeURIComponent(selectedAsset._id)}`}>
                    Manage
                  </Link>
                ) : null}
              </div>

              <div className="device-info-panel devices-detail-summary">
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
                  <strong>
                    <StatusPill status={selectedAsset.status} />
                  </strong>
                </div>
              </div>

              <div className="device-info-panel device-info-history-panel devices-history-panel">
                <div className="device-info-history-panel-header">
                  <div>
                    <strong className="device-info-panel-title">History</strong>
                    <div className="table-subtle">Full audit timeline for this device.</div>
                  </div>
                </div>

                {historyError ? <div className="page-message error">{historyError}</div> : null}
                {historyLoading ? <div className="page-message">Loading history…</div> : null}

                {!historyLoading && history.length ? (
                  <div className="device-info-history-scroll devices-history-scroll">
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
                  <div className="empty-state">No history found for this device.</div>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
