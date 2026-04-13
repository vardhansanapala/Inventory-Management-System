const { Schema, model } = require("mongoose");

const MaintenanceRecordSchema = new Schema(
  {
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    issue: {
      type: String,
      required: true,
      trim: true,
    },
    vendor: {
      type: String,
      default: "",
      trim: true,
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["IN_REPAIR", "COMPLETED"],
      default: "IN_REPAIR",
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const MaintenanceRecord = model("MaintenanceRecord", MaintenanceRecordSchema);

module.exports = {
  MaintenanceRecord,
};
