const { ASSET_ACTIONS, ACTION_REASONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { Asset } = require("../models/Asset");
const { AuditLog } = require("../models/AuditLog");
const { Location } = require("../models/Location");
const { Product } = require("../models/Product");
const { User } = require("../models/User");
const { ApiError } = require("../utils/ApiError");
const { ensureAssetId } = require("./assetId.service");
const { buildAssetQrValue, buildAssetScanUrl, generateQrPngBuffer } = require("./qr.service");
const { uploadQrCodeBuffer, deleteObjectIfExists } = require("./s3.service");

function isDuplicateAssetIdError(error) {
  return error?.code === 11000 && (error?.keyPattern?.assetId || error?.keyValue?.assetId);
}

async function assertCreationRefs({ productId, locationId, assignedToId, performedById, session }) {
  const product = await Product.findOne({ _id: productId, isDeleted: false }).session(session);
  const location = await Location.findOne({ _id: locationId, isDeleted: false }).session(session);
  const assignedTo = assignedToId
    ? await User.findOne({ _id: assignedToId, isDeleted: false }).session(session)
    : null;
  const performedBy = await User.findOne({ _id: performedById, isDeleted: false }).session(session);

  if (!product) {
    throw new ApiError(400, "Invalid product reference");
  }

  if (!location) {
    throw new ApiError(400, "Invalid location reference");
  }

  if (assignedToId && !assignedTo) {
    throw new ApiError(400, "Invalid assignee reference");
  }

  if (!performedBy) {
    throw new ApiError(400, "Invalid actor reference");
  }

  return { product, location, assignedTo, performedBy };
}

async function buildAssetQrFields(assetId) {
  const qrCode = buildAssetQrValue(assetId);
  const qrBuffer = await generateQrPngBuffer(qrCode);
  const uploadKey = `qrcodes/${assetId}.png`;
  const uploaded = await uploadQrCodeBuffer({
    key: uploadKey,
    buffer: qrBuffer,
  });

  return {
    qrCode,
    uploadKey: uploaded.key,
    qrCodeUrl: uploaded.url,
    qrDeepLink: buildAssetScanUrl(assetId),
  };
}

function applyAssetQrFields(asset, qrFields) {
  asset.qrCode = qrFields.qrCode;
  asset.qrCodeUrl = qrFields.qrCodeUrl;
  asset.qrStorageKey = qrFields.uploadKey;
  asset.qrDeepLink = qrFields.qrDeepLink;
}

function clearAssetQrFields(asset) {
  asset.qrCode = "";
  asset.qrCodeUrl = "";
  asset.qrStorageKey = "";
  asset.qrDeepLink = "";
}

async function regenerateAssetQr(asset, session) {
  if (!asset?.assetId) {
    throw new ApiError(400, "Asset ID is required before regenerating a QR code");
  }

  const qrFields = await buildAssetQrFields(asset.assetId);
  applyAssetQrFields(asset, qrFields);
  await asset.save({ session });
  return qrFields;
}

async function createAssetWithQr({
  payload,
  performedById,
  source = "WEB",
  session,
}) {
  await assertCreationRefs({
    productId: payload.productId,
    locationId: payload.locationId,
    assignedToId: payload.assignedToId,
    performedById,
    session,
  });

  const asset = new Asset({
    product: payload.productId,
    serialNumber: payload.serialNumber || null,
    status: payload.status || (payload.assignedToId ? ASSET_STATUSES.ASSIGNED : ASSET_STATUSES.AVAILABLE),
    location: payload.locationId,
    assignedTo: payload.assignedToId || null,
    purchaseDate: payload.purchaseDate || null,
    metadata: payload.metadata || {},
    lastActionAt: new Date(),
  });

  if (asset.status === ASSET_STATUSES.ASSIGNED && !payload.assignedToId) {
    throw new ApiError(400, "assignedToId is required when creating an assigned asset");
  }

  let qrFields = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await ensureAssetId(asset, session);
    qrFields = await buildAssetQrFields(asset.assetId);

    try {
      applyAssetQrFields(asset, qrFields);
      await asset.save({ session });
      break;
    } catch (error) {
      await deleteObjectIfExists(qrFields.uploadKey);
      clearAssetQrFields(asset);

      if (isDuplicateAssetIdError(error) && attempt < 2) {
        asset.assetId = "";
        qrFields = null;
        continue;
      }

      throw error;
    }
  }

  try {
    if (!qrFields) {
      throw new ApiError(500, "Unable to generate a unique asset ID");
    }

    const [auditLog] = await AuditLog.create(
      [
        {
          asset: asset._id,
          assetId: asset.assetId,
          action:
            payload.importSource === "BULK_IMPORT" ? ASSET_ACTIONS.BULK_IMPORT : ASSET_ACTIONS.CREATE,
          reason: ACTION_REASONS.OTHER,
          customReason: payload.creationReason || "",
          performedBy: performedById,
          source,
          notes: payload.notes || "Asset created",
          fromStatus: null,
          toStatus: asset.status,
          fromLocation: null,
          toLocation: asset.location,
          fromAssignee: null,
          toAssignee: asset.assignedTo,
          ...(payload.clientActionId ? { clientActionId: payload.clientActionId } : {}),
          metadata: {
            productId: String(asset.product),
            assetId: asset.assetId,
            qrCode: qrFields.qrCode,
            qrDeepLink: asset.qrDeepLink,
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    return {
      asset,
      auditLog,
      uploadKey: qrFields.uploadKey,
    };
  } catch (error) {
    await deleteObjectIfExists(qrFields.uploadKey);
    throw error;
  }
}

module.exports = {
  regenerateAssetQr,
  createAssetWithQr,
};
