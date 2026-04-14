const { Schema, model } = require("mongoose");

const RBAC_AUDIT_TARGET_TYPES = {
  USER: "USER",
  ASSET: "ASSET",
};

const RbacAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: Object.values(RBAC_AUDIT_TARGET_TYPES),
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const RbacAuditLog = model("RbacAuditLog", RbacAuditLogSchema);

module.exports = {
  RBAC_AUDIT_TARGET_TYPES,
  RbacAuditLog,
};

