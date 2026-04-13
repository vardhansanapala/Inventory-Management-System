const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/asset_inventory",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  publicApiBaseUrl:
    process.env.PUBLIC_API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`,
  qrDeepLinkBaseUrl:
    process.env.QR_DEEP_LINK_BASE_URL || "http://localhost:5173/scan",
  awsRegion: process.env.AWS_REGION || "ap-south-1",
  awsS3Bucket: process.env.AWS_S3_BUCKET || "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  queueEnabled: process.env.QUEUE_ENABLED !== "false",
  jwtSecret: process.env.JWT_SECRET || "replace-me",
  defaultSuperAdminEmail:
    process.env.DEFAULT_SUPER_ADMIN_EMAIL || "superadmin@company.com",
  defaultSuperAdminPassword:
    process.env.DEFAULT_SUPER_ADMIN_PASSWORD || "Admin@123",
  resetSuperAdminPasswordOnBoot:
    process.env.RESET_SUPER_ADMIN_PASSWORD_ON_BOOT
      ? process.env.RESET_SUPER_ADMIN_PASSWORD_ON_BOOT === "true"
      : (process.env.NODE_ENV || "development") !== "production",
};
