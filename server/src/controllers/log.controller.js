const { AuditLog } = require("../models/AuditLog");
const { UserAuditLog } = require("../models/UserAuditLog");
const { RbacAuditLog } = require("../models/RbacAuditLog");

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
  const shouldFetchRbac = !logType || logType === "ASSET" || logType === "USER";

  const [assetLogs, userLogs, rbacLogs] = await Promise.all([
    shouldFetchAssets
      ? AuditLog.find(actionType ? { action: actionType, isDeleted: false } : { isDeleted: false })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .populate("performedBy", "firstName lastName email role")
          .populate("asset", "assetId")
      : Promise.resolve([]),
    shouldFetchUsers
      ? UserAuditLog.find(actionType ? { actionType } : {})
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .populate("performedBy", "firstName lastName email role")
          .populate("targetUserId", "firstName lastName email role status")
      : Promise.resolve([]),
    shouldFetchRbac
      ? RbacAuditLog.find(actionType ? { action: actionType } : {})
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .populate("performedBy", "firstName lastName email role")
      : Promise.resolve([]),
  ]);

  const normalizedAssetLogs = assetLogs.map((log) => ({
    _id: `asset:${log._id}`,
    rawId: String(log._id),
    logType: "ASSET",
    actionType: log.action,
    performedBy: log.performedBy || null,
    targetUser: null,
    assetCode: log.assetId || log.asset?.assetId || null,
    metadata: log.metadata || {},
    createdAt: log.createdAt || log.timestamp,
    timestamp: log.timestamp || log.createdAt,
  }));

  const normalizedUserLogs = userLogs.map((log) => ({
    _id: `user:${log._id}`,
    rawId: String(log._id),
    logType: "USER",
    actionType: log.actionType,
    performedBy: log.performedBy || null,
    targetUser: log.targetUserId || null,
    assetCode: null,
    metadata: log.metadata || {},
    createdAt: log.createdAt || log.timestamp,
    timestamp: log.timestamp || log.createdAt,
  }));

  const normalizedRbacLogs = rbacLogs.map((log) => ({
    _id: `rbac:${log._id}`,
    rawId: String(log._id),
    logType: log.targetType,
    actionType: log.action,
    performedBy: log.performedBy || null,
    targetUser: null,
    assetCode: log.targetType === "ASSET" ? log.metadata?.assetId || null : null,
    metadata: log.metadata || {},
    createdAt: log.createdAt,
    timestamp: log.createdAt,
  }));

  let combined = [...normalizedAssetLogs, ...normalizedUserLogs, ...normalizedRbacLogs].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.timestamp).getTime();
    const rightTime = new Date(right.createdAt || right.timestamp).getTime();
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    // Stable tie-breaker: ObjectId is roughly time-ordered.
    return String(right.rawId || "").localeCompare(String(left.rawId || ""));
  });

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
    logs: combined.slice(0, limit).map(({ rawId, ...rest }) => rest),
  });
}

module.exports = {
  listLogs,
};
