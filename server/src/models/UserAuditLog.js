const { Schema, model } = require("mongoose");

const USER_AUDIT_ACTIONS = {
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED",
  PASSWORD_RESET: "PASSWORD_RESET",
  ACCOUNT_PAUSED: "ACCOUNT_PAUSED",
  ACCOUNT_RESUMED: "ACCOUNT_RESUMED",
  USER_DELETED: "USER_DELETED",
};

const UserAuditLogSchema = new Schema(
  {
    actionType: {
      type: String,
      enum: Object.values(USER_AUDIT_ACTIONS),
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "audit_logs",
  }
);

const UserAuditLog = model("UserAuditLog", UserAuditLogSchema);

module.exports = {
  USER_AUDIT_ACTIONS,
  UserAuditLog,
};
