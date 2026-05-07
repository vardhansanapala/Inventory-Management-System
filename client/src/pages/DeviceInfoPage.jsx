import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { getAssetById, getAssetDetails, getAssets } from "../api/inventory";
import { LocationBadge, getLocationLabel } from "../components/LocationBadge";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { getDisplayAssetStatus } from "../constants/assetWorkflow";
import { useAuth } from "../context/AuthContext";
import { getAssetWfhAddress } from "../utils/asset.util";
import { getLastUpdatedValue, getSortableTime } from "../utils/date.util";

const HISTORY_PREVIEW_COUNT = 5;
const WFH_LOCATION_FILTER = "WFH";
const ALL_FILTER_VALUE = "ALL";
const ADMIN_FETCH_LIMIT = 1000;

function formatUser(user) {
  if (!user) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "-";
}

function getAssetSearchText(asset) {
  return [
    asset?.assetId,
    asset?.product?.sku,
    formatUser(asset?.assignedTo),
    asset?.assignedTo?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isWfhLocation(asset) {
  return String(asset?.locationType || "").trim().toUpperCase() === "WFH";
}

function getUniqueLocations(assets = []) {
  const physicalLocations = new Map();
  let hasWfhLocation = false;

  assets.forEach((asset) => {
    if (isWfhLocation(asset)) {
      hasWfhLocation = true;
      return;
    }

    const locationId = String(asset?.location?._id || "");
    if (!locationId) return;
    physicalLocations.set(locationId, asset.location);
  });

  return {
    physicalLocations: Array.from(physicalLocations.values()),
    hasWfhLocation,
  };
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

function areValuesEqual(fromValue, toValue) {
  return String(fromValue ?? "").trim() === String(toValue ?? "").trim();
}

function getAssigneeIdentity(user) {
  return String(user?._id || user?.email || `${user?.firstName || ""} ${user?.lastName || ""}`)
    .trim();
}

function buildChangeRows(event) {
  const rows = [];

  if (event.from?.status || event.to?.status) {
    const fromStatus = event.from?.status || null;
    const toStatus = event.to?.status || null;

    if (!areValuesEqual(fromStatus, toStatus)) {
      rows.push({
        label: "Status",
        from: fromStatus ? getDisplayAssetStatus(fromStatus) : "-",
        to: toStatus ? getDisplayAssetStatus(toStatus) : "-",
      });
    }
  }

  if (event.fromLocation || event.toLocation || event.from?.status || event.to?.status) {
    const fromLocation = getLocationLabel(event.fromLocation, event.fromLocationType, event.from?.status);
    const toLocation = getLocationLabel(event.toLocation, event.toLocationType, event.to?.status);

    if (!areValuesEqual(fromLocation, toLocation)) {
      rows.push({
        label: "Location",
        from: fromLocation || "-",
        to: toLocation || "-",
      });
    }
  }

  if (event.fromAssignee || event.toAssignee) {
    const fromAssignee = event.fromAssignee || null;
    const toAssignee = event.toAssignee || null;

    if (!areValuesEqual(getAssigneeIdentity(fromAssignee), getAssigneeIdentity(toAssignee))) {
      rows.push({
        label: "Assignee",
        from: fromAssignee ? formatUser(fromAssignee) : "-",
        to: toAssignee ? formatUser(toAssignee) : "-",
      });
    }
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
                <span className="device-info-history-change-label">{change.label}</span>
                {change.label === "Location" ? (
                  <div className="change-row">
                    <LocationBadge
                      status={event.from?.status}
                      locationType={event.fromLocationType}
                      location={event.fromLocation}
                    />
                    <ArrowRight size={14} className="history-arrow" />
                    <LocationBadge
                      status={event.to?.status}
                      locationType={event.toLocationType}
                      location={event.toLocation}
                    />
                  </div>
                ) : (
                  <strong>
                    {change.from} to {change.to}
                  </strong>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function DeviceInfoPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const { assetId: routeAssetId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [selectedUserId, setSelectedUserId] = useState(ALL_FILTER_VALUE);
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_FILTER_VALUE);
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

  const hasHiddenHistory = selectedAssetHistory.length > HISTORY_PREVIEW_COUNT;
  const visibleHistory = historyExpanded ? selectedAssetHistory : selectedAssetHistory.slice(0, HISTORY_PREVIEW_COUNT);

  async function fetchAssets() {
    setLoading(true);
    setError("");
    try {
      const result = await getAssets({
        page: isSuperAdmin ? 1 : page,
        limit: isSuperAdmin ? ADMIN_FETCH_LIMIT : limit,
        search: isSuperAdmin ? "" : search,
      });
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
  }, [isSuperAdmin, page, search]);

  const filterUsers = useMemo(() => (
    Array.from(
      new Map(
        assets
          .filter((asset) => asset?.assignedTo?._id)
          .map((asset) => [asset.assignedTo._id, asset.assignedTo])
      ).values()
    )
  ), [assets]);

  const filterLocations = useMemo(() => getUniqueLocations(assets), [assets]);

  const filteredAssets = useMemo(() => {
    if (!isSuperAdmin) {
      return assets;
    }

    const normalizedSearch = search.trim().toLowerCase();

    const searchFiltered = normalizedSearch
      ? assets.filter((asset) => getAssetSearchText(asset).includes(normalizedSearch))
      : assets;

    const userFiltered = selectedUserId === ALL_FILTER_VALUE
      ? searchFiltered
      : searchFiltered.filter((asset) => String(asset?.assignedTo?._id || "") === selectedUserId);

    const locationFiltered = selectedLocationId === ALL_FILTER_VALUE
      ? userFiltered
      : selectedLocationId === WFH_LOCATION_FILTER
        ? userFiltered.filter((asset) => isWfhLocation(asset))
        : userFiltered.filter((asset) => String(asset?.location?._id || "") === selectedLocationId);

    return [...locationFiltered].sort((left, right) => {
      const leftTime = getSortableTime(getLastUpdatedValue(left));
      const rightTime = getSortableTime(getLastUpdatedValue(right));
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [assets, isSuperAdmin, search, selectedLocationId, selectedUserId, sort]);

  const displayTotal = isSuperAdmin ? filteredAssets.length : total;
  const displayTotalPages = isSuperAdmin ? Math.max(Math.ceil(filteredAssets.length / limit), 1) : totalPages;
  const renderedAssets = isSuperAdmin
    ? filteredAssets.slice((page - 1) * limit, page * limit)
    : filteredAssets;

  const pageLabel = useMemo(() => {
    const safeTotalPages = Math.max(displayTotalPages || 1, 1);
    const safePage = Math.min(Math.max(page, 1), safeTotalPages);
    return `Page ${safePage} of ${safeTotalPages}`;
  }, [displayTotalPages, page]);

  useEffect(() => {
    if (page > displayTotalPages) {
      setPage(displayTotalPages);
    }
  }, [displayTotalPages, page]);

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
  const canNext = page < displayTotalPages;

  return (
    <div className="page-stack">
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard
        title="Device Info"
        subtitle={user?.role === "SUPER_ADMIN" ? "View all devices with searchable registry and detailed history." : "View your assigned devices with detailed history."}
        actions={<span className="role-chip">{user?.role || "-"}</span>}
      >
        <div className="device-info-toolbar">
          {isSuperAdmin ? (
            <div className="devices-toolbar devices-toolbar-flat">
              <input
                className="input"
                placeholder="Search by asset ID, SKU, or user..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Search devices"
              />
              <label className="field-stack devices-filter-field">
                <span>Sort</span>
                <select
                  className="input"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
              <label className="field-stack devices-filter-field">
                <span>User</span>
                <select
                  className="input"
                  value={selectedUserId}
                  onChange={(event) => {
                    setSelectedUserId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value={ALL_FILTER_VALUE}>ALL</option>
                  {filterUsers.map((targetUser) => (
                    <option key={targetUser._id} value={targetUser._id}>
                      {formatUser(targetUser)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-stack devices-filter-field">
                <span>Location</span>
                <select
                  className="input"
                  value={selectedLocationId}
                  onChange={(event) => {
                    setSelectedLocationId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value={ALL_FILTER_VALUE}>ALL</option>
                  {filterLocations.physicalLocations.map((location) => (
                    <option key={location._id} value={location._id}>
                      {location.name}
                    </option>
                  ))}
                  {filterLocations.hasWfhLocation ? <option value={WFH_LOCATION_FILTER}>WFH</option> : null}
                </select>
              </label>
            </div>
          ) : null}
          <div className="device-info-pagination">
            <span className="table-subtle">
              {pageLabel} | {displayTotal} devices{loading ? " | Loading..." : ""}
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
              ) : renderedAssets.length ? (
                renderedAssets.map((asset) => {
                  return (
                  <tr key={asset._id} onClick={() => openDetails(asset)} className="device-info-row">
                    <td>
                      <strong>{asset.assetId}</strong>
                      <div className="table-subtle">{asset.serialNumber || "No serial"}</div>
                    </td>
                    <td>{asset.product?.sku || "-"}</td>
                    <td>
                      <StatusPill status={asset.status} />
                    </td>
                    <td>
                      <LocationBadge
                        status={asset.status}
                        locationType={asset.locationType}
                        location={asset.location}
                      />
                    </td>
                    <td>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button className="button ghost button-rect button-sm" type="button" onClick={() => openDetails(asset)}>
                        View
                      </button>
                    </td>
                  </tr>
                  );
                })
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
        >
          {detailsLoading ? <div className="page-message">Loading details...</div> : null}

          {selectedAssetDetails ? (() => {
            const selectedLocationLabel = getLocationLabel(
              selectedAssetDetails.location,
              selectedAssetDetails.locationType,
              selectedAssetDetails.status
            );

            return (
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
                  <LocationBadge
                    status={selectedAssetDetails.status}
                    locationType={selectedAssetDetails.locationType}
                    location={selectedAssetDetails.location}
                  />
                </div>
                {selectedLocationLabel === "WFH" ? (
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
            );
          })() : null}
        </Modal>
      ) : null}
    </div>
  );
}
