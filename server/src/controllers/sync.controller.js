const { startSession } = require("mongoose");
const { ACTION_REASONS } = require("../constants/asset.constants");
const { applyAssetAction } = require("../services/assetAction.service");
const { ApiError } = require("../utils/ApiError");

const MAX_TRANSACTION_RETRIES = 3;

function isRetryableTransactionError(error) {
  if (!error) return false;
  if (typeof error.hasErrorLabel === "function") {
    if (error.hasErrorLabel("TransientTransactionError") || error.hasErrorLabel("UnknownTransactionCommitResult")) {
      return true;
    }
  }

  return /writeconflict|transienttransactionerror|unknowntransactioncommitresult/i.test(String(error.message || ""));
}

async function runSyncActionTransaction(work) {
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

async function syncOfflineActions(req, res) {
  const performedById = req.user?._id || req.body.performedById;
  if (!performedById) {
    throw new ApiError(400, "performedById is required");
  }

  const actions = Array.isArray(req.body.actions) ? req.body.actions : [];
  const results = [];

  for (const item of actions) {
    try {
      const result = await runSyncActionTransaction((session) =>
        applyAssetAction({
        assetIdentifier: item.assetId || item.assetCode,
        action: item.action,
        performedById,
        reason: item.reason || ACTION_REASONS.OTHER,
        customReason: item.customReason || "",
        notes: item.notes || "",
        locationId: item.locationId || null,
        assignedToId: item.assignedToId || null,
        clientActionId: item.clientActionId || null,
        source: "MOBILE",
        payload: item,
        session,
        })
      );

      results.push({
        clientActionId: item.clientActionId || null,
        status: result.duplicate ? "duplicate" : "applied",
        assetId: result.asset?.assetId || result.auditLog.assetId,
        assetCode: result.asset?.assetId || result.auditLog.assetId,
        auditLogId: result.auditLog._id,
      });
    } catch (error) {
      results.push({
        clientActionId: item.clientActionId || null,
        status: "failed",
        error: error.message,
      });
    }
  }

  res.json({
    results,
  });
}

module.exports = {
  syncOfflineActions,
};
