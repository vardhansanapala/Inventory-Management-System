const { UserAuditLog } = require("../models/UserAuditLog");

async function createUserAuditLog({ actionType, performedBy, targetUserId, metadata = {} }) {
  return UserAuditLog.create({
    actionType,
    performedBy,
    targetUserId,
    metadata,
    timestamp: new Date(),
  });
}

module.exports = {
  createUserAuditLog,
};
