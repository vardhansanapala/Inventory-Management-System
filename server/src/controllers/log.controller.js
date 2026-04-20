const { AuditLog } = require("../models/AuditLog");
const { RbacAuditLog } = require("../models/RbacAuditLog");

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSearchHaystack(log) {
  const performedByName = log.performedBy
    ? `${log.performedBy.firstName || ""} ${log.performedBy.lastName || ""}`.trim().toLowerCase()
    : "";
  const targetName = log.targetUser
    ? `${log.targetUser.firstName || ""} ${log.targetUser.lastName || ""}`.trim().toLowerCase()
    : "";

  const summaryText = Array.isArray(log.summary)
    ? log.summary
        .map((change) => `${change.label || ""} ${Array.isArray(change.before) ? change.before.join(" ") : change.before || ""} ${Array.isArray(change.after) ? change.after.join(" ") : change.after || ""}`)
        .join(" ")
    : "";

  return `${log.logType} ${log.actionType} ${log.assetCode || ""} ${performedByName} ${targetName} ${log.targetUser?.email || ""} ${summaryText}`.toLowerCase();
}

function buildAssetLogSummary(log) {
  const changes = [];

  if (log.fromStatus || log.toStatus) {
    changes.push({ label: "Status", before: log.fromStatus || "-", after: log.toStatus || "-" });
  }
  if (log.fromLocation?.name || log.toLocation?.name) {
    changes.push({ label: "Location", before: log.fromLocation?.name || "-", after: log.toLocation?.name || "-" });
  }
  if (log.fromAssignee || log.toAssignee) {
    const beforeAssignee = log.fromAssignee ? `${log.fromAssignee.firstName || ""} ${log.fromAssignee.lastName || ""}`.trim() || log.fromAssignee.email : "-";
    const afterAssignee = log.toAssignee ? `${log.toAssignee.firstName || ""} ${log.toAssignee.lastName || ""}`.trim() || log.toAssignee.email : "-";
    changes.push({ label: "Assignee", before: beforeAssignee, after: afterAssignee });
  }

  if (Array.isArray(log.metadata?.changes)) {
    return log.metadata.changes;
  }

  return changes;
}

async function listLogs(req, res) {
  const actionType = String(req.query.actionType || "").trim();
  const logType = String(req.query.logType || "").trim().toUpperCase();
  const search = normalizeSearch(req.query.search);
  const limit = Math.min(Number(req.query.limit) || 100, 250);
  const fetchLimit = search ? 250 : limit;

  const shouldFetchAssetLogs = !logType || logType === "ASSET";
  const assetAuditQuery = { isDeleted: false };
  if (actionType) {
    assetAuditQuery.action = actionType;
  }

  const rbacQuery = {};
  if (actionType) {
    rbacQuery.action = actionType;
  }
  if (logType === "ASSET" || logType === "USER") {
    rbacQuery.targetType = logType;
  }

  const [assetLogs, rbacLogs] = await Promise.all([
    shouldFetchAssetLogs
      ? AuditLog.find(assetAuditQuery)
          .sort({ timestamp: -1, createdAt: -1, _id: -1 })
          .limit(fetchLimit)
          .populate("performedBy", "firstName lastName email role")
          .populate("asset", "assetId")
      : Promise.resolve([]),
    !logType || logType === "ASSET" || logType === "USER"
      ? RbacAuditLog.find(rbacQuery)
          .sort({ createdAt: -1, _id: -1 })
          .limit(fetchLimit)
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
    summary: buildAssetLogSummary(log),
    createdAt: log.createdAt || log.timestamp,
    timestamp: log.timestamp || log.createdAt,
  }));

  const normalizedRbacLogs = rbacLogs.map((log) => ({
    _id: `rbac:${log._id}`,
    rawId: String(log._id),
    logType: log.targetType,
    actionType: log.action,
    performedBy: log.performedBy || null,
    targetUser: log.targetType === "USER" ? { ...log.metadata?.targetUser } : null,
    assetCode: log.targetType === "ASSET" ? log.metadata?.assetId || null : null,
    metadata: log.metadata || {},
    summary: Array.isArray(log.metadata?.changes) ? log.metadata.changes : [],
    createdAt: log.createdAt,
    timestamp: log.createdAt,
  }));

  let combined = [...normalizedAssetLogs, ...normalizedRbacLogs];

  if (logType === "ASSET" || logType === "USER") {
    combined = combined.filter((log) => log.logType === logType);
  }

  if (search) {
    combined = combined.filter((log) => buildSearchHaystack(log).includes(search));
  }

  combined.sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.timestamp).getTime();
    const rightTime = new Date(right.createdAt || right.timestamp).getTime();
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return String(right.rawId || "").localeCompare(String(left.rawId || ""));
  });

  res.json({
    logs: combined.slice(0, limit).map(({ rawId, ...rest }) => rest),
  });
}

module.exports = {
  listLogs,
};
