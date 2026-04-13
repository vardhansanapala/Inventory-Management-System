const { Schema, model } = require("mongoose");
const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");

const AuditLogSchema = new Schema(
  {
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    assetId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(ASSET_ACTIONS),
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: Object.values(ACTION_REASONS),
      default: ACTION_REASONS.OTHER,
    },
    customReason: {
      type: String,
      default: "",
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["WEB", "MOBILE", "BULK_IMPORT", "SYSTEM"],
      default: "WEB",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    fromStatus: {
      type: String,
      enum: Object.values(ASSET_STATUSES),
      default: null,
    },
    toStatus: {
      type: String,
      enum: Object.values(ASSET_STATUSES),
      default: null,
    },
    fromLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },
    toLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },
    fromAssignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    toAssignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clientActionId: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AuditLogSchema.virtual("assetCode")
  .get(function getAssetCode() {
    return this.assetId;
  })
  .set(function setAssetCode(value) {
    this.assetId = value;
  });

const AuditLog = model("AuditLog", AuditLogSchema);

module.exports = {
  AuditLog,
};
