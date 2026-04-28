import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAssetsByUser } from "../api/inventory";
import { getDisplayAssetStatus } from "../constants/assetWorkflow";
import { PERMISSIONS, hasAnyWritePermission, hasPermission } from "../constants/permissions";
import { Modal } from "./Modal";
import { StatusPill } from "./StatusPill";

function formatUser(user) {
  if (!user) return "-";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "-";
}

function formatTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
}

function getDeviceName(asset) {
  const brand = String(asset?.product?.brand || "").trim();
  const model = String(asset?.product?.model || "").trim();
  const combined = [brand, model].filter(Boolean).join(" ");
  return combined || asset?.assetId || "Device";
}

export function UserAssignedAssetsModal({ currentUser, targetUser, onClose }) {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const canOpenAssets = hasAnyWritePermission(currentUser, "ASSET");
  const canAssignAsset = hasPermission(currentUser, PERMISSIONS.ASSIGN_ASSET);
  const canManageInWorkspace = canOpenAssets || canAssignAsset;
  const selectedAsset = assets.find((asset) => String(asset._id) === String(selectedAssetId)) || assets[0] || null;

  useEffect(() => {
    if (!targetUser?._id) return undefined;

    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      setError("");

      try {
        const result = await getAssetsByUser(targetUser._id);
        if (cancelled) return;

        const nextAssets = Array.isArray(result) ? result : [];
        setAssets(nextAssets);
        setSelectedAssetId((current) => {
          if (current && nextAssets.some((asset) => String(asset._id) === String(current))) {
            return current;
          }

          return nextAssets[0]?._id || "";
        });
      } catch (err) {
        if (!cancelled) {
          setAssets([]);
          setSelectedAssetId("");
          setError(err.message || "Unable to load assigned devices.");
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
  }, [targetUser?._id]);

  function handleOpenAssetsWorkspace() {
    if (!selectedAsset) return;
    navigate("/assets");
    onClose();
  }

  function handleOpenAssignWorkspace() {
    if (!selectedAsset) return;
    navigate("/assign-device", { state: { asset: selectedAsset } });
    onClose();
  }

  const targetUserName = targetUser
    ? `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() || targetUser.email || "Employee"
    : "Employee";

  return (
    <Modal
      className="device-info-modal user-devices-modal"
      title="Assigned Devices"
      subtitle={`${targetUserName} | ${loading ? "Loading..." : `${assets.length} device${assets.length === 1 ? "" : "s"}`}`}
      onClose={onClose}
      actions={
        <>
          {canOpenAssets && selectedAsset ? (
            <button className="button ghost button-rect" type="button" onClick={handleOpenAssetsWorkspace}>
              Open Assets
            </button>
          ) : null}
          {canAssignAsset && selectedAsset ? (
            <button className="button dark button-rect" type="button" onClick={handleOpenAssignWorkspace}>
              Manage Device
            </button>
          ) : null}
          <button className="button ghost button-rect" type="button" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {error ? <div className="page-message error">{error}</div> : null}

      <div className="device-info-modal-grid user-devices-modal-grid">
        <div className="device-info-panel">
          <div className="employee-device-intro user-devices-header">
            <div>
              <strong>{targetUserName}'s Devices</strong>
              <p className="table-subtle">Read-only inventory view for the selected employee.</p>
            </div>
            <div className="employee-device-count">{loading ? "Loading..." : `${assets.length} assigned`}</div>
          </div>

          {loading ? (
            <div className="page-message">Loading assigned devices...</div>
          ) : assets.length ? (
            <div className="table-wrap user-devices-table-wrap">
              <table className="table device-info-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>SKU</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const isSelected = String(asset._id) === String(selectedAsset?._id);

                    return (
                      <tr
                        key={asset._id}
                        className={isSelected ? "selected-row device-info-row" : "device-info-row"}
                        onClick={() => setSelectedAssetId(asset._id)}
                      >
                        <td>
                          <strong>{asset.assetId}</strong>
                          <div className="table-subtle">{asset.serialNumber || "No serial"}</div>
                        </td>
                        <td>{asset.product?.sku || "-"}</td>
                        <td>
                          <StatusPill status={asset.status} />
                        </td>
                        <td>{asset.location?.name || "-"}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <button className="button ghost button-rect button-sm" type="button" onClick={() => setSelectedAssetId(asset._id)}>
                            {isSelected ? "Viewing" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No devices are currently assigned to this employee.</div>
          )}
        </div>

        <div className="device-info-panel">
          <div className="user-devices-detail-header">
            <div>
              <strong className="device-info-panel-title">Device Details</strong>
              <div className="table-subtle">
                {selectedAsset ? `Updated ${formatTimestamp(selectedAsset.updatedAt)}` : "Select a device to inspect its details."}
              </div>
            </div>
            {!canManageInWorkspace && selectedAsset ? <span className="role-chip">Read Only</span> : null}
          </div>

          {selectedAsset ? (
            <div className="user-devices-detail-stack">
              <div className="device-info-kv">
                <span>Device Name</span>
                <strong>{getDeviceName(selectedAsset)}</strong>
              </div>
              <div className="device-info-kv">
                <span>Asset ID</span>
                <strong>{selectedAsset.assetId || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>SKU</span>
                <strong>{selectedAsset.product?.sku || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Serial Number</span>
                <strong>{selectedAsset.serialNumber || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Status</span>
                <strong>{getDisplayAssetStatus(selectedAsset.status)}</strong>
              </div>
              <div className="device-info-kv">
                <span>Location</span>
                <strong>{selectedAsset.location?.name || "-"}</strong>
              </div>
              <div className="device-info-kv">
                <span>Assigned User</span>
                <strong>{formatUser(selectedAsset.assignedTo)}</strong>
              </div>
              <div className="device-info-kv">
                <span>Product</span>
                <strong>{getDeviceName(selectedAsset)}</strong>
              </div>
              {selectedAsset.product?.brand || selectedAsset.product?.model ? (
                <div className="device-info-kv">
                  <span>Brand / Model</span>
                  <strong>{[selectedAsset.product?.brand, selectedAsset.product?.model].filter(Boolean).join(" ") || "-"}</strong>
                </div>
              ) : null}
              {!canManageInWorkspace ? (
                <div className="table-subtle">This view is read-only because your account does not have asset workspace permissions.</div>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">Choose a device from the list to view its details.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
