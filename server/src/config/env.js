const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase() === "true";
}, z.boolean());

const optionalTrimmed = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().optional());

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: optionalTrimmed,
  CLIENT_ORIGIN: optionalTrimmed,
  PUBLIC_API_BASE_URL: optionalTrimmed,
  QR_DEEP_LINK_BASE_URL: optionalTrimmed,
  AWS_REGION: optionalTrimmed,
  AWS_S3_BUCKET: optionalTrimmed,
  AWS_ACCESS_KEY_ID: optionalTrimmed,
  AWS_SECRET_ACCESS_KEY: optionalTrimmed,
  REDIS_URL: optionalTrimmed,
  QUEUE_ENABLED: booleanFromEnv.default(true),
  JWT_SECRET: optionalTrimmed,
  COOKIE_SECRET: optionalTrimmed,
  ENABLE_BOOTSTRAP: booleanFromEnv.default(false),
  DEFAULT_SUPER_ADMIN_EMAIL: optionalTrimmed,
  DEFAULT_SUPER_ADMIN_PASSWORD: optionalTrimmed,
  DEFAULT_SUPER_ADMIN_FIRST_NAME: optionalTrimmed,
  DEFAULT_SUPER_ADMIN_LAST_NAME: optionalTrimmed,
  DEFAULT_SUPER_ADMIN_EMPLOYEE_CODE: optionalTrimmed,
});

const parsed = rawEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === "production";
const missing = [];

if (isProduction) {
  if (!raw.JWT_SECRET) missing.push("JWT_SECRET");
  if (!raw.MONGODB_URI) missing.push("MONGODB_URI");
  if (!raw.COOKIE_SECRET) missing.push("COOKIE_SECRET");
}

if (isProduction && raw.ENABLE_BOOTSTRAP) {
  if (!raw.DEFAULT_SUPER_ADMIN_EMAIL) missing.push("DEFAULT_SUPER_ADMIN_EMAIL");
  if (!raw.DEFAULT_SUPER_ADMIN_PASSWORD) missing.push("DEFAULT_SUPER_ADMIN_PASSWORD");
  if (!raw.DEFAULT_SUPER_ADMIN_FIRST_NAME) missing.push("DEFAULT_SUPER_ADMIN_FIRST_NAME");
  if (!raw.DEFAULT_SUPER_ADMIN_LAST_NAME) missing.push("DEFAULT_SUPER_ADMIN_LAST_NAME");
  if (!raw.DEFAULT_SUPER_ADMIN_EMPLOYEE_CODE) missing.push("DEFAULT_SUPER_ADMIN_EMPLOYEE_CODE");
}

if (missing.length) {
  throw new Error(
    `Missing required production environment configuration: ${Array.from(new Set(missing)).join(", ")}`
  );
}

module.exports = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  port: raw.PORT,
  mongoUri: raw.MONGODB_URI || "mongodb://127.0.0.1:27017/asset_inventory",
  clientOrigin: raw.CLIENT_ORIGIN || "http://localhost:5173",
  publicApiBaseUrl: raw.PUBLIC_API_BASE_URL || `http://localhost:${raw.PORT}`,
  qrDeepLinkBaseUrl: raw.QR_DEEP_LINK_BASE_URL || "http://localhost:5173/device-info?assetId=",
  awsRegion: raw.AWS_REGION || "ap-south-1",
  awsS3Bucket: raw.AWS_S3_BUCKET || "",
  awsAccessKeyId: raw.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: raw.AWS_SECRET_ACCESS_KEY || "",
  redisUrl: raw.REDIS_URL || "redis://127.0.0.1:6379",
  queueEnabled: raw.QUEUE_ENABLED,
  jwtSecret: raw.JWT_SECRET || "dev-only-change-me-jwt-secret",
  cookieSecret: raw.COOKIE_SECRET || "dev-only-change-me-cookie-secret",
  enableBootstrap: raw.ENABLE_BOOTSTRAP,
  defaultSuperAdminEmail: raw.DEFAULT_SUPER_ADMIN_EMAIL || "superadmin@company.com",
  defaultSuperAdminPassword: raw.DEFAULT_SUPER_ADMIN_PASSWORD || "Admin@123",
  defaultSuperAdminFirstName: raw.DEFAULT_SUPER_ADMIN_FIRST_NAME || "System",
  defaultSuperAdminLastName: raw.DEFAULT_SUPER_ADMIN_LAST_NAME || "Super Admin",
  defaultSuperAdminEmployeeCode: raw.DEFAULT_SUPER_ADMIN_EMPLOYEE_CODE || "SYS-ADMIN",
};
