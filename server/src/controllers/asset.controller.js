const { isValidObjectId, startSession } = require("mongoose");
const { ACTION_REASONS } = require("../constants/asset.constants");
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

function serializeAsset(asset) {
  const payload = asset.toObject ? asset.toObject() : { ...asset };
  const qrCode = payload.qrCode || buildAssetQrValue(payload.assetId);

  return {
    ...payload,
    qrCode,
    qrDeepLink: payload.qrDeepLink || qrCode,
  };
}

async function listAssets(req, res) {
  const filter = {
    isDeleted: false,
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.locationId) {
    filter.location = req.query.locationId;
  }

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), "i");
    const matchingProducts = await Product.find({
      sku: regex,
      isDeleted: false,
    }).select("_id");

    filter.$or = [
      { assetId: regex },
      { serialNumber: regex },
      ...(matchingProducts.length
        ? [{ product: { $in: matchingProducts.map((product) => product._id) } }]
        : []),
    ];
  }

  const assets = await Asset.find(filter)
    .sort({ createdAt: -1 })
    .populate("product")
    .populate("location")
    .populate("assignedTo", "firstName lastName email");

  res.json(assets.map(serializeAsset));
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
    .sort({ createdAt: -1 })
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

  const session = await startSession();

  try {
    // This transaction is the core integrity boundary: the asset mutation and the
    // audit log insert either both succeed or both roll back.
    session.startTransaction();

    const result = await applyAssetAction({
      assetIdentifier: req.params.assetId,
      action: req.body.action,
      performedById,
      reason: req.body.reason || ACTION_REASONS.OTHER,
      customReason: req.body.customReason || "",
      notes: req.body.notes || "",
      locationId: req.body.locationId || null,
      assignedToId: req.body.assignedToId || null,
      clientActionId: req.body.clientActionId || null,
      source: "WEB",
      payload: req.body,
      session,
    });

    await session.commitTransaction();

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
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  getAssetBootstrap,
  listAssets,
  getAssetById,
  getDeviceByIdPublic,
  getAssetQrCode,
  regenerateAssetQrCode,
  getAssetAuditLogs,
  createAsset,
  performAssetAction,
};
