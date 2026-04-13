const IORedis = require("ioredis");
const env = require("./env");

const redisConnection = env.queueEnabled
  ? new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
  : null;

module.exports = {
  redisConnection,
};
