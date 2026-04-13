const env = require("../config/env");
const { Worker } = require("bullmq");
const { parse } = require("csv-parse/sync");
const { startSession } = require("mongoose");
const { connectDb } = require("../config/db");
const { redisConnection } = require("../config/redis");
const { Product } = require("../models/Product");
const { Location } = require("../models/Location");
const { createAssetWithQr } = require("../services/assetCreation.service");
const { deleteObjectIfExists } = require("../services/s3.service");

async function processCsvImport(job) {
  const csvText = Buffer.from(job.data.csvBase64, "base64").toString("utf8");
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const results = [];

  for (const row of records) {
    const session = await startSession();
    let uploadKey = null;

    try {
      session.startTransaction();

      const product = await Product.findOne({
        sku: String(row.sku || "").trim().toUpperCase(),
        isDeleted: false,
      }).session(session);

      const location = await Location.findOne({
        code: String(row.locationCode || "").trim().toUpperCase(),
        isDeleted: false,
      }).session(session);

      if (!product) {
        throw new Error(`SKU not found: ${row.sku}`);
      }

      if (!location) {
        throw new Error(`Location not found: ${row.locationCode}`);
      }

      const result = await createAssetWithQr({
        payload: {
          productId: product._id,
          serialNumber: row.serialNumber || null,
          locationId: location._id,
          status: row.status || undefined,
          notes: row.notes || "Imported from CSV",
          metadata: {
            importFilename: job.data.filename,
          },
          importSource: "BULK_IMPORT",
        },
        performedById: job.data.performedById,
        source: "BULK_IMPORT",
        session,
      });

      uploadKey = result.uploadKey;
      await session.commitTransaction();

      results.push({
        status: "created",
        assetId: result.asset.assetId,
        assetCode: result.asset.assetId,
      });
    } catch (error) {
      await session.abortTransaction();
      await deleteObjectIfExists(uploadKey);
      results.push({
        status: "failed",
        serialNumber: row.serialNumber || null,
        error: error.message,
      });
    } finally {
      await session.endSession();
    }
  }

  return {
    filename: job.data.filename,
    results,
  };
}

async function startWorker() {
  if (!env.queueEnabled) {
    console.log("Bulk import worker is disabled because QUEUE_ENABLED=false");
    return;
  }

  await connectDb();

  const worker = new Worker("asset-bulk-import", processCsvImport, {
    connection: redisConnection,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`Bulk import job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Bulk import job ${job?.id} failed`, error);
  });
}

startWorker().catch((error) => {
  console.error("Worker failed to start", error);
  process.exit(1);
});
