const { isValidObjectId, startSession } = require("mongoose");
const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { Asset } = require("../models/Asset");
const { AuditLog } = require("../models/AuditLog");
const { Location } = require("../models/Location");
const { Product } = require("../models/Product");
const { User } = require("../models/User");
const { buildAssetQrValue, generateQrPngBuffer, normalizeAssetId } = require("../services/qr.service");
const { ApiError } = require("../utils/ApiError");
const { createAssetWithQr, regenerateAssetQr } = require("../services/assetCreation.service");
const { deleteObjectIfExists } = require("../services/s3.service");
const { applyAssetAction } = require("../services/assetAction.service");
const { normalizeAction } = require("../services/assetState.service");
const { PERMISSIONS } = require("../constants/permissions");
const { RBAC_AUDIT_TARGET_TYPES, RbacAuditLog } = require("../models/RbacAuditLog");

const MAX_TRANSACTION_RETRIES = 3;

function isRetryableTransactionError(error) {
  if (!error) return false;
  if (typeof error.hasErrorLabel === "function") {
    if (error.hasErrorLabel("TransientTransactionError") || error.hasErrorLabel("UnknownTransactionCommitResult")) {
      return true;
    }
  }

  const message = String(error.message || "");
  return /writeconflict|transienttransactionerror|unknowntransactioncommitresult/i.test(message);
}

async function runAssetActionTransaction(work) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    const session = await startSession();

    try {
      session.startTransaction();
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      lastError = error;
      await session.abortTransaction();

      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_RETRIES) {
        throw error;
      }
    } finally {
      await session.endSession();
    }
  }

  throw lastError;
}

async function getAssetBootstrap(req, res) {
  const [products, locations, users] = await Promise.all([
    Product.find({ isDeleted: false }).populate("category").sort({ sku: 1 }),
    Location.find({ isDeleted: false }).sort({ name: 1 }),
    User.find({
      isDeleted: false,
      isActive: true,
      status: { $in: ["ACTIVE", null] },
    }).sort({ firstName: 1, lastName: 1 }),
  ]);

  res.json({
    products,
    locations,
    users: users.map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
    })),
  });
}

function resolveActorId(req) {
  return req.user?._id || null;
}

function assertAssetActionPermission(req, action) {
  const normalizedAction = normalizeAction(action);
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const requiredPermission = normalizedAction === ASSET_ACTIONS.ASSIGN_DEVICE
    ? PERMISSIONS.ASSIGN_ASSET
    : PERMISSIONS.UPDATE_ASSET;

  if (!permissions.includes(requiredPermission)) {
    throw new ApiError(403, `Missing permission: ${requiredPermission}`);
  }
}

function serializeAsset(asset) {
  const payload = asset.toObject ? asset.toObject() : { ...asset };
  const qrCode = payload.qrCode || buildAssetQrValue(payload.assetId);
  const metadata = payload.metadata || {};
  const locationType = String(payload.locationType || metadata.locationType || "PHYSICAL").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
  const wfhAddress = String(payload.wfhAddress || metadata.wfhAddress || "").trim();

  return {
    ...payload,
    qrCode,
    qrDeepLink: payload.qrDeepLink || qrCode,
    locationType,
    wfhAddress,
  };
}

function normalizeSearch(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listAssets(req, res) {
  const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;
  if (hasPaginationParams && req.user?.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "Only super admins can access paginated device info");
  }

  const filter = {
    isDeleted: false,
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.locationId) {
    filter.location = req.query.locationId;
  }

  const search = normalizeSearch(req.query.search);

  if (search) {
    const escapedSearch = escapeRegex(search);
    const matchingProducts = await Product.find({
      isDeleted: false,
      sku: { $regex: escapedSearch, $options: "i" },
    })
      .select("_id")
      .lean();

    filter.$or = [
      { assetId: { $regex: escapedSearch, $options: "i" } },
      { serialNumber: { $regex: escapedSearch, $options: "i" } },
      ...(matchingProducts.length
        ? [{ product: { $in: matchingProducts.map((product) => product._id) } }]
        : []),
    ];
  }

  if (hasPaginationParams) {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("product")
        .populate("location")
        .populate("assignedTo", "firstName lastName email"),
      Asset.countDocuments(filter),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.json({
      data: assets.map(serializeAsset),
      total,
      page,
      totalPages,
    });
    return;
  }

  const assets = await Asset.find(filter)
    .sort({ createdAt: -1 })
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  res.json(assets.map(serializeAsset));
}

async function listMyAssets(req, res) {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const assets = await Asset.find({
    assignedTo: userId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  const serializedAssets = assets.map(serializeAsset);
  const includeAuditLogs = String(req.query.includeAuditLogs || "").toLowerCase() === "true";

  if (!includeAuditLogs || !assets.length) {
    res.json(serializedAssets);
    return;
  }

  const parsedLimit = Number(req.query.auditLogLimit);
  const auditLogLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 5;

  const assetIds = assets.map((asset) => asset._id);
  const logs = await AuditLog.find({
    asset: { $in: assetIds },
    isDeleted: false,
  })
    .sort({ timestamp: -1, createdAt: -1, _id: -1 })
    .populate("performedBy", "firstName lastName email")
    .populate("fromLocation toLocation", "name code")
    .populate("fromAssignee toAssignee", "firstName lastName email");

  const logsByAssetId = new Map();

  for (const log of logs) {
    const key = String(log.asset);
    const currentLogs = logsByAssetId.get(key) || [];

    if (currentLogs.length < auditLogLimit) {
      currentLogs.push(log);
      logsByAssetId.set(key, currentLogs);
    }
  }

  res.json(
    serializedAssets.map((asset) => ({
      ...asset,
      recentAuditLogs: logsByAssetId.get(String(asset._id)) || [],
    }))
  );
}

async function listAssetsByUser(req, res) {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const assets = await Asset.find({
    assignedTo: userId,
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  res.json(assets.map(serializeAsset));
}

async function getAssetDetails(req, res) {
  if (req.user?.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "Only super admins can access device info details");
  }

  const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId))
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  const logs = await AuditLog.find({
    asset: asset._id,
    isDeleted: false,
  })
    .sort({ timestamp: -1, createdAt: -1, _id: -1 })
    .populate("performedBy", "firstName lastName email")
    .populate("fromLocation toLocation", "name code")
    .populate("fromAssignee toAssignee", "firstName lastName email");

  const history = logs.map((log) => {
    const action = String(log.action || "");
    const lower = action.toLowerCase();

    const isRepair = lower.includes("repair");
    const isRental = lower.includes("rent");
    const isSale = lower.includes("sell");
    const isOutside = lower.includes("outside") || action === "SEND_OUTSIDE" || action === "RETURN_DEVICE";
    const isAssign = lower.includes("assign");

    const type = isRepair ? "REPAIR" : isRental ? "RENTAL" : isSale ? "SALE" : isOutside ? "OUTSIDE" : isAssign ? "ASSIGNED" : "EVENT";

    return {
      type,
      action,
      user: log.performedBy
        ? {
            _id: log.performedBy._id,
            firstName: log.performedBy.firstName,
            lastName: log.performedBy.lastName,
            email: log.performedBy.email,
          }
        : null,
      from: log.fromStatus ? { status: log.fromStatus } : null,
      to: log.toStatus ? { status: log.toStatus } : null,
      reason: log.reason || null,
      description: log.notes || log.customReason || "",
      timestamp: log.timestamp || log.createdAt,
      fromLocation: log.fromLocation ? { _id: log.fromLocation._id, name: log.fromLocation.name } : null,
      toLocation: log.toLocation ? { _id: log.toLocation._id, name: log.toLocation.name } : null,
      fromAssignee: log.fromAssignee
        ? { _id: log.fromAssignee._id, firstName: log.fromAssignee.firstName, lastName: log.fromAssignee.lastName, email: log.fromAssignee.email }
        : null,
      toAssignee: log.toAssignee
        ? { _id: log.toAssignee._id, firstName: log.toAssignee.firstName, lastName: log.toAssignee.lastName, email: log.toAssignee.email }
        : null,
    };
  });

  res.json({
    asset: {
      _id: asset._id,
      assetId: asset.assetId,
      sku: asset.product?.sku || null,
      serialNumber: asset.serialNumber || null,
      status: asset.status,
      locationType: String(asset.locationType || asset.metadata?.locationType || "PHYSICAL").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL",
      wfhAddress: String(asset.wfhAddress || asset.metadata?.wfhAddress || "").trim(),
      location: asset.location ? { _id: asset.location._id, name: asset.location.name } : null,
      assignedTo: asset.assignedTo
        ? { _id: asset.assignedTo._id, firstName: asset.assignedTo.firstName, lastName: asset.assignedTo.lastName, email: asset.assignedTo.email }
        : null,
    },
    history,
  });
}

function buildAssetLookupQuery(identifier) {
  const normalizedIdentifier = String(identifier || "").trim();

  if (!normalizedIdentifier) {
    throw new ApiError(400, "Asset identifier is required");
  }

  return isValidObjectId(normalizedIdentifier)
    ? { _id: normalizedIdentifier, isDeleted: false }
    : { assetId: normalizeAssetId(normalizedIdentifier), isDeleted: false };
}

async function getAssetById(req, res) {
  const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId))
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  res.json(serializeAsset(asset));
}

async function getDeviceByIdPublic(req, res) {
  const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId))
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  res.json(serializeAsset(asset));
}

async function getAssetQrCode(req, res) {
  const assetId = normalizeAssetId(req.params.assetId);

  const asset = await Asset.findOne({
    assetId,
    isDeleted: false,
  }).select("assetId");

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  const qrPayload = buildAssetQrValue(asset.assetId);
  const buffer = await generateQrPngBuffer(qrPayload);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buffer);
}

async function regenerateAssetQrCode(req, res) {
  const session = await startSession();

  try {
    session.startTransaction();

    const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId)).session(session);
    if (!asset) {
      throw new ApiError(404, "Asset not found");
    }

    await regenerateAssetQr(asset, session);
    await session.commitTransaction();

    const refreshedAsset = await Asset.findById(asset._id)
      .populate("product")
      .populate("location")
      .populate("assignedTo", "firstName lastName email");

    res.json(serializeAsset(refreshedAsset));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

async function getAssetAuditLogs(req, res) {
  const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId)).select("_id");

  if (!asset) {
    throw new ApiError(404, "Asset not found");
  }

  const logs = await AuditLog.find({
    asset: asset._id,
    isDeleted: false,
  })
    .sort({ timestamp: -1, createdAt: -1, _id: -1 })
    .populate("performedBy", "firstName lastName email")
    .populate("fromLocation toLocation", "name code")
    .populate("fromAssignee toAssignee", "firstName lastName email");

  res.json(logs);
}

async function createAsset(req, res) {
  const performedById = resolveActorId(req);
  if (!performedById) {
    throw new ApiError(400, "performedById is required");
  }

  const session = await startSession();
  let uploadKey = null;

  try {
    session.startTransaction();

    const result = await createAssetWithQr({
      payload: req.body,
      performedById,
      session,
      source: "WEB",
    });

    uploadKey = result.uploadKey;
    await session.commitTransaction();

    const asset = await Asset.findById(result.asset._id)
      .populate("product")
      .populate("location")
      .populate("assignedTo", "firstName lastName email");

    await RbacAuditLog.create({
      action: "ASSET_CREATED",
      performedBy: performedById,
      targetId: asset._id,
      targetType: RBAC_AUDIT_TARGET_TYPES.ASSET,
      metadata: {
        assetId: asset.assetId,
        productId: asset.product?._id || asset.product,
        locationId: asset.location?._id || asset.location,
        assignedToId: asset.assignedTo?._id || asset.assignedTo || null,
        status: asset.status,
      },
    });

    res.status(201).json(serializeAsset(asset));
  } catch (error) {
    await session.abortTransaction();
    await deleteObjectIfExists(uploadKey);
    throw error;
  } finally {
    await session.endSession();
  }
}

async function performAssetAction(req, res) {
  const performedById = resolveActorId(req);
  if (!performedById) {
    throw new ApiError(400, "performedById is required");
  }

  const actionName = normalizeAction(req.body.action);
  assertAssetActionPermission(req, actionName);

  const result = await runAssetActionTransaction(async (session) => {
    const actionResult = await applyAssetAction({
      assetIdentifier: req.params.assetId,
      action: req.body.action,
      performedById,
      reason: req.body.reason || ACTION_REASONS.OTHER,
      customReason: req.body.customReason || "",
      notes: req.body.notes || "",
      locationId: req.body.locationId || req.body.toLocationId || null,
      assignedToId: req.body.assignedToId || null,
      clientActionId: req.body.clientActionId || null,
      source: "WEB",
      payload: req.body,
      session,
    });

    if (actionResult.duplicate) {
      return actionResult;
    }

    if (actionName === "ASSIGN_DEVICE") {
      await RbacAuditLog.create(
        [
          {
            action: "ASSET_ASSIGNED",
            performedBy: performedById,
            targetId: actionResult.asset._id,
            targetType: RBAC_AUDIT_TARGET_TYPES.ASSET,
            metadata: {
              assetId: actionResult.asset.assetId,
              toAssigneeId: actionResult.asset.assignedTo?._id || actionResult.asset.assignedTo || null,
              toLocationId: actionResult.asset.location?._id || actionResult.asset.location || null,
              status: actionResult.asset.status,
            },
          },
        ],
        { session }
      );
    }

    return actionResult;
  });

  if (result.duplicate) {
    return res.status(200).json({
      duplicate: true,
      auditLogId: result.auditLog._id,
    });
  }

  const asset = await Asset.findById(result.asset._id)
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  return res.json({
    duplicate: false,
    asset: serializeAsset(asset),
    auditLogId: result.auditLog._id,
  });
}

async function updateAsset(req, res) {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (!permissions.includes(PERMISSIONS.UPDATE_ASSET)) {
    throw new ApiError(403, "Missing permission: UPDATE_ASSET");
  }

  const populated = await runAssetActionTransaction(async (session) => {
    const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId)).session(session);
    if (!asset) {
      throw new ApiError(404, "Asset not found");
    }

    const before = {
      product: asset.product,
      serialNumber: asset.serialNumber,
      location: asset.location,
      locationType: asset.locationType,
      wfhAddress: asset.wfhAddress,
      assignedTo: asset.assignedTo,
      status: asset.status,
    };

    if (req.body.productId !== undefined) {
      const product = await Product.findOne({ _id: req.body.productId, isDeleted: false }).session(session);
      if (!product) {
        throw new ApiError(400, "Invalid product reference");
      }
      asset.product = product._id;
    }

    if (req.body.serialNumber !== undefined) {
      asset.serialNumber = String(req.body.serialNumber || "").trim() || null;
    }

    const nextLocationType = req.body.locationType !== undefined
      ? (String(req.body.locationType || "").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL")
      : String(asset.locationType || "PHYSICAL").trim().toUpperCase();
    const hasLocationPayload = req.body.locationId !== undefined || req.body.locationType !== undefined || req.body.wfhAddress !== undefined;

    if (hasLocationPayload) {
      if (nextLocationType === "WFH") {
        const nextWfhAddress = String(req.body.wfhAddress !== undefined ? req.body.wfhAddress : asset.wfhAddress || "").trim();
        if (!nextWfhAddress) {
          throw new ApiError(400, "WFH Address is required when location is WFH.");
        }
        asset.locationType = "WFH";
        asset.wfhAddress = nextWfhAddress;
        asset.location = null;
      } else {
        const nextLocationId = req.body.locationId !== undefined ? req.body.locationId : asset.location;
        const location = await Location.findOne({ _id: nextLocationId, isDeleted: false }).session(session);
        if (!location) {
          throw new ApiError(400, "Invalid location reference");
        }
        asset.locationType = "PHYSICAL";
        asset.wfhAddress = "";
        asset.location = location._id;
      }

      asset.metadata = {
        ...(asset.metadata || {}),
        locationType: asset.locationType,
        wfhAddress: asset.wfhAddress,
      };
    }

    if (req.body.assignedToId !== undefined) {
      if (!req.body.assignedToId) {
        asset.assignedTo = null;
      } else {
        const user = await User.findOne({ _id: req.body.assignedToId, isDeleted: false }).session(session);
        if (!user) {
          throw new ApiError(400, "Invalid assignee reference");
        }
        asset.assignedTo = user._id;
      }
    }

    if (req.body.status !== undefined) {
      const nextStatus = String(req.body.status || "").trim();
      if (!Object.values(ASSET_STATUSES).includes(nextStatus)) {
        throw new ApiError(400, "Invalid asset status");
      }
      asset.status = nextStatus;
    }

    await asset.save({ session });

    const populatedAsset = await Asset.findById(asset._id)
      .populate("product")
      .populate("location")
      .populate("assignedTo", "firstName lastName email")
      .session(session);

    if (!populatedAsset) {
      throw new ApiError(404, "Asset not found");
    }

    await RbacAuditLog.create(
      [
        {
          action: "ASSET_UPDATED",
          performedBy: req.user?._id,
          targetId: asset._id,
          targetType: RBAC_AUDIT_TARGET_TYPES.ASSET,
          metadata: {
            assetId: populatedAsset.assetId,
            before,
            after: {
              product: populatedAsset.product?._id || populatedAsset.product,
              serialNumber: populatedAsset.serialNumber,
              location: populatedAsset.location?._id || populatedAsset.location,
              locationType: populatedAsset.locationType,
              wfhAddress: populatedAsset.wfhAddress,
              assignedTo: populatedAsset.assignedTo?._id || populatedAsset.assignedTo || null,
              status: populatedAsset.status,
            },
          },
        },
      ],
      { session }
    );

    return populatedAsset;
  });

  res.json(serializeAsset(populated));
}

async function deleteAsset(req, res) {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (!permissions.includes(PERMISSIONS.DELETE_ASSET)) {
    throw new ApiError(403, "Missing permission: DELETE_ASSET");
  }

  await runAssetActionTransaction(async (session) => {
    const asset = await Asset.findOne(buildAssetLookupQuery(req.params.assetId)).session(session);
    if (!asset) {
      throw new ApiError(404, "Asset not found");
    }

    asset.isDeleted = true;
    await asset.save({ session });

    await RbacAuditLog.create(
      [
        {
          action: "ASSET_DELETED",
          performedBy: req.user?._id,
          targetId: asset._id,
          targetType: RBAC_AUDIT_TARGET_TYPES.ASSET,
          metadata: {
            assetId: asset.assetId,
          },
        },
      ],
      { session }
    );
  });

  res.json({ message: "Asset deleted successfully" });
}

module.exports = {
  getAssetBootstrap,
  listAssets,
  listMyAssets,
  listAssetsByUser,
  getAssetById,
  getAssetDetails,
  getDeviceByIdPublic,
  getAssetQrCode,
  regenerateAssetQrCode,
  getAssetAuditLogs,
  createAsset,
  performAssetAction,
  updateAsset,
  deleteAsset,
};
