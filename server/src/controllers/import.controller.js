const { bulkImportQueue } = require("../queues/bulkImport.queue");
const env = require("../config/env");
const { ApiError } = require("../utils/ApiError");

async function enqueueAssetCsvImport(req, res) {
  if (!env.queueEnabled || !bulkImportQueue) {
    throw new ApiError(
      503,
      "Bulk import queue is disabled. Enable Redis and set QUEUE_ENABLED=true to use CSV imports."
    );
  }

  if (!req.file) {
    throw new ApiError(400, "CSV file is required");
  }

  const performedById = req.user?._id || req.body.performedById;
  if (!performedById) {
    throw new ApiError(400, "performedById is required");
  }

  const job = await bulkImportQueue.add(
    "asset-csv-import",
    {
      csvBase64: req.file.buffer.toString("base64"),
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      performedById: String(performedById),
    },
    {
      attempts: 3,
      removeOnComplete: 50,
      removeOnFail: 50,
    }
  );

  res.status(202).json({
    message: "Bulk import queued",
    jobId: job.id,
  });
}

module.exports = {
  enqueueAssetCsvImport,
};
