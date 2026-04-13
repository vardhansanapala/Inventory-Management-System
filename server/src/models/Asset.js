const { Schema, model } = require("mongoose");
const { ensureAssetId } = require("../services/assetId.service");
const { ASSET_STATUSES } = require("../constants/asset.constants");

const AssetSchema = new Schema(
  {
    assetId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: Object.values(ASSET_STATUSES),
      default: ASSET_STATUSES.AVAILABLE,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    qrCodeUrl: {
      type: String,
      default: "",
      trim: true,
    },
    qrStorageKey: {
      type: String,
      default: "",
      trim: true,
    },
    qrDeepLink: {
      type: String,
      default: "",
      trim: true,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastActionAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AssetSchema.virtual("assetCode")
  .get(function getAssetCode() {
    return this.assetId;
  })
  .set(function setAssetCode(value) {
    this.assetId = value;
  });

// Counter-backed ID allocation is done in a pre-validate hook so every new asset gets
// a human-readable code before save, even under concurrent writes or inside a transaction.
AssetSchema.pre("validate", async function allocateCode(next) {
  if (!this.isNew || this.assetId) {
    return next();
  }

  try {
    await ensureAssetId(this, this.$session?.());
    return next();
  } catch (error) {
    return next(error);
  }
});

const Asset = model("Asset", AssetSchema);

module.exports = {
  Asset,
};
