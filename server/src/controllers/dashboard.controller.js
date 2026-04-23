const { ASSET_STATUSES } = require("../constants/asset.constants");
const { Asset } = require("../models/Asset");
const { AuditLog } = require("../models/AuditLog");
const { MaintenanceRecord } = require("../models/MaintenanceRecord");

async function getDashboardSummary(_req, res) {
  const [totalAssets, statusBreakdown, recentLogs, openRepairs] = await Promise.all([
    Asset.countDocuments({
      isDeleted: false,
      status: { $nin: [ASSET_STATUSES.SOLD, ASSET_STATUSES.LOST] },
    }),
    Asset.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    AuditLog.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("performedBy", "firstName lastName email")
      .populate("asset", "assetId"),
    MaintenanceRecord.countDocuments({ isDeleted: false, status: "IN_REPAIR" }),
  ]);

  const normalizedStatusMap = Object.values(ASSET_STATUSES).reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  statusBreakdown.forEach((row) => {
    normalizedStatusMap[row._id] = row.count;
  });

  res.json({
    totalAssets,
    openRepairs,
    statusBreakdown: normalizedStatusMap,
    recentLogs,
  });
}

module.exports = {
  getDashboardSummary,
};
