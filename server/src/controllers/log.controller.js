const { AuditLog } = require("../models/AuditLog");
const { UserAuditLog } = require("../models/UserAuditLog");

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

async function listLogs(req, res) {
  const actionType = String(req.query.actionType || "").trim();
  const logType = String(req.query.logType || "").trim().toUpperCase();
  const search = normalizeSearch(req.query.search);
  const limit = Math.min(Number(req.query.limit) || 100, 250);

  const shouldFetchAssets = !logType || logType === "ASSET";
  const shouldFetchUsers = !logType || logType === "USER";

  const [assetLogs, userLogs] = await Promise.all([
    shouldFetchAssets
      ? AuditLog.find(actionType ? { action: actionType, isDeleted: false } : { isDeleted: false })
          .sort({ timestamp: -1, createdAt: -1 })
          .limit(limit)
          .populate("performedBy", "firstName lastName email role")
          .populate("asset", "assetId")
      : Promise.resolve([]),
    shouldFetchUsers
      ? UserAuditLog.find(actionType ? { actionType } : {})
          .sort({ timestamp: -1, createdAt: -1 })
          .limit(limit)
          .populate("performedBy", "firstName lastName email role")
          .populate("targetUserId", "firstName lastName email role status")
      : Promise.resolve([]),
  ]);

  const normalizedAssetLogs = assetLogs.map((log) => ({
    _id: `asset:${log._id}`,
    logType: "ASSET",
    actionType: log.action,
    performedBy: log.performedBy || null,
    targetUser: null,
    assetCode: log.assetId || log.asset?.assetId || null,
    metadata: log.metadata || {},
    timestamp: log.timestamp || log.createdAt,
  }));

  const normalizedUserLogs = userLogs.map((log) => ({
    _id: `user:${log._id}`,
    logType: "USER",
    actionType: log.actionType,
    performedBy: log.performedBy || null,
    targetUser: log.targetUserId || null,
    assetCode: null,
    metadata: log.metadata || {},
    timestamp: log.timestamp || log.createdAt,
  }));

  let combined = [...normalizedAssetLogs, ...normalizedUserLogs].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );

  if (search) {
    combined = combined.filter((log) => {
      const performedByName = log.performedBy
        ? `${log.performedBy.firstName || ""} ${log.performedBy.lastName || ""}`.trim().toLowerCase()
        : "";
      const targetName = log.targetUser
        ? `${log.targetUser.firstName || ""} ${log.targetUser.lastName || ""}`.trim().toLowerCase()
        : "";
      const haystack = `${log.logType} ${log.actionType} ${log.assetCode || ""} ${performedByName} ${targetName} ${log.targetUser?.email || ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  res.json({
    logs: combined.slice(0, limit),
  });
}

module.exports = {
  listLogs,
};
