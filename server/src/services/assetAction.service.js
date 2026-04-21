const { isValidObjectId } = require("mongoose");
const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { Asset } = require("../models/Asset");
const { AuditLog } = require("../models/AuditLog");
const { Location } = require("../models/Location");
const { MaintenanceRecord } = require("../models/MaintenanceRecord");
const { User } = require("../models/User");
const { ApiError } = require("../utils/ApiError");
const { buildTransition, resolveActionReason } = require("./assetState.service");

async function findAssetForAction(assetIdentifier, session) {
  const normalizedIdentifier = String(assetIdentifier || "").trim().toUpperCase();
  const query = isValidObjectId(assetIdentifier)
    ? { _id: assetIdentifier, isDeleted: false }
    : { assetId: normalizedIdentifier, isDeleted: false };

  const asset = await Asset.findOne(query).session(session);

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  return asset;
}

async function resolveActionRefs({ locationId, assignedToId, performedById, session }) {
  const location = locationId
    ? await Location.findOne({ _id: locationId, isDeleted: false }).session(session)
    : null;
  const assignedTo = assignedToId
    ? await User.findOne({ _id: assignedToId, isDeleted: false }).session(session)
    : null;
  const performedBy = await User.findOne({ _id: performedById, isDeleted: false }).session(session);

  if (locationId && !location) {
    throw new ApiError(400, "Invalid location reference");
  }

  if (assignedToId && !assignedTo) {
    throw new ApiError(400, "Invalid assignee reference");
  }

  if (!performedBy) {
    throw new ApiError(400, "Invalid actor reference");
  }

  return { location, assignedTo, performedBy };
}

async function upsertMaintenanceIfNeeded(asset, action, payload, session, fromStatus) {
  if (action === ASSET_ACTIONS.SEND_FOR_REPAIR) {
    const [record] = await MaintenanceRecord.create(
      [
        {
          asset: asset._id,
          issue: payload.issue || payload.notes || "Repair requested",
          vendor: payload.vendor || "",
          cost: Number(payload.cost || 0),
          status: "IN_REPAIR",
          startDate: payload.startDate || new Date(),
          notes: payload.notes || "",
        },
      ],
      { session }
    );

    return record;
  }

  if (action === ASSET_ACTIONS.RETURN_DEVICE && fromStatus === ASSET_STATUSES.UNDER_REPAIR) {
    const record = await MaintenanceRecord.findOne({
      asset: asset._id,
      status: "IN_REPAIR",
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .session(session);

    if (record) {
      record.status = "COMPLETED";
      record.endDate = payload.endDate || new Date();
      record.notes = payload.notes || record.notes;
      await record.save({ session });
    }

    return record;
  }

  return null;
}

async function applyAssetAction({
  assetIdentifier,
  action,
  performedById,
  reason = ACTION_REASONS.OTHER,
  customReason = "",
  notes = "",
  locationId = null,
  assignedToId = null,
  clientActionId = null,
  source = "WEB",
  payload = {},
  session,
}) {
  if (clientActionId) {
    const duplicate = await AuditLog.findOne({ clientActionId }).session(session);
    if (duplicate) {
      return {
        duplicate: true,
        auditLog: duplicate,
      };
    }
  }

  const asset = await findAssetForAction(assetIdentifier, session);
  const refs = await resolveActionRefs({
    locationId,
    assignedToId,
    performedById,
    session,
  });

  const fromStatus = asset.status;
  const normalizedReason = resolveActionReason(action, reason);
  const fromLocation = asset.location;
  const fromAssignee = asset.assignedTo;

  // Pre-condition checks to prevent no-op / duplicate actions.
  // These run before any writes/log creation so we avoid unnecessary DB work.
  if (action === ASSET_ACTIONS.ASSIGN_DEVICE) {
    const currentAssigneeId = fromAssignee ? String(fromAssignee) : "";
    const nextAssigneeId = refs.assignedTo?._id ? String(refs.assignedTo._id) : "";
    if (currentAssigneeId && nextAssigneeId && currentAssigneeId === nextAssigneeId) {
      throw new ApiError(400, "Asset is already assigned to this user.");
    }
  }

  if (action === ASSET_ACTIONS.TRANSFER) {
    const currentLocationId = fromLocation ? String(fromLocation) : "";
    const nextLocationId = refs.location?._id ? String(refs.location._id) : "";
    if (currentLocationId && nextLocationId && currentLocationId === nextLocationId) {
      throw new ApiError(400, "Asset is already in the target location.");
    }
  }
  const transition = buildTransition({
    asset,
    action,
    refs,
    payload,
    reason: normalizedReason,
  });

  const nextStatus = transition.status;
  if (nextStatus && String(nextStatus) === String(fromStatus || "")) {
    const nextLocationId = transition.location ? String(transition.location) : "";
    const nextAssigneeId = transition.assignedTo ? String(transition.assignedTo) : "";
    const currentLocationId = fromLocation ? String(fromLocation) : "";
    const currentAssigneeId = fromAssignee ? String(fromAssignee) : "";

    if (nextLocationId === currentLocationId && nextAssigneeId === currentAssigneeId) {
      throw new ApiError(400, `Asset is already in status: ${nextStatus}`);
    }
  }

  asset.status = transition.status;
  asset.location = transition.location;
  asset.assignedTo = transition.assignedTo;
  asset.metadata = {
    ...(asset.metadata || {}),
    ...(transition.metadata || {}),
  };
  asset.lastActionAt = new Date();
  await asset.save({ session });

  const maintenanceRecord = await upsertMaintenanceIfNeeded(asset, action, payload, session, fromStatus);

  const [auditLog] = await AuditLog.create(
    [
      {
        asset: asset._id,
        assetId: asset.assetId,
        action,
        reason: normalizedReason,
        customReason,
        performedBy: performedById,
        source,
        notes,
        fromStatus,
        toStatus: asset.status,
        fromLocation,
        toLocation: asset.location,
        fromAssignee,
        toAssignee: asset.assignedTo,
        ...(clientActionId ? { clientActionId } : {}),
        metadata: {
          ...(transition.metadata || {}),
          ...(maintenanceRecord ? { maintenanceRecordId: String(maintenanceRecord._id) } : {}),
          assetId: asset.assetId,
        },
        timestamp: new Date(),
      },
    ],
    { session }
  );

  return {
    duplicate: false,
    asset,
    auditLog,
    maintenanceRecord,
  };
}

module.exports = {
  applyAssetAction,
};
