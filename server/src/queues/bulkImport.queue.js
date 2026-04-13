const { Queue } = require("bullmq");
const env = require("../config/env");
const { redisConnection } = require("../config/redis");

const bulkImportQueue = env.queueEnabled
  ? new Queue("asset-bulk-import", {
      connection: redisConnection,
    })
  : null;

module.exports = {
  bulkImportQueue,
};
