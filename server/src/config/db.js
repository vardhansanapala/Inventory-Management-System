const mongoose = require("mongoose");
const env = require("./env");
const { Asset } = require("../models/Asset");
const { ensureAssetId } = require("../services/assetId.service");

function buildLegacyAssetId(asset) {
  return `LEG-${String(asset._id).toUpperCase()}`;
}

async function backfillMissingAssetIds() {
  const assetsWithoutId = await Asset.find({
    $or: [{ assetId: null }, { assetId: "" }, { assetId: { $exists: false } }],
  }).select("_id product assetId");

  if (!assetsWithoutId.length) {
    return;
  }

  const operations = [];

  for (const asset of assetsWithoutId) {
    let assetId;

    try {
      assetId = await ensureAssetId(asset);
    } catch (error) {
      // Keep startup resilient for legacy rows that cannot derive category/product metadata.
      assetId = buildLegacyAssetId(asset);
    }

    operations.push({
      updateOne: {
        filter: {
          _id: asset._id,
          $or: [{ assetId: null }, { assetId: "" }, { assetId: { $exists: false } }],
        },
        update: {
          $set: { assetId },
        },
      },
    });
  }

  if (operations.length) {
    await Asset.bulkWrite(operations, { ordered: false });
    console.log(`Backfilled assetId for ${operations.length} legacy assets`);
  }
}

async function reconcileAssetIndexes() {
  const assetsCollection = mongoose.connection.collection("assets");
  const indexes = await assetsCollection.indexes();
  const hasLegacyAssetCodeIndex = indexes.some((index) => index.name === "assetCode_1");

  if (hasLegacyAssetCodeIndex) {
    await assetsCollection.dropIndex("assetCode_1");
    console.log("Dropped legacy assets index assetCode_1");
  }

  await backfillMissingAssetIds();

  // Keep index definitions aligned with the current Asset schema (assetId is canonical).
  await Asset.syncIndexes();
}

async function connectDb() {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.mongoUri, {
    autoIndex: true,
  });
  await reconcileAssetIndexes();

  console.log("MongoDB connected");
}

module.exports = {
  connectDb,
  mongoose,
};

