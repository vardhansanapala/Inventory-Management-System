const { DeleteObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const env = require("../config/env");

async function uploadQrCodeBuffer({ key, buffer, contentType = "image/png" }) {
  if (!env.awsS3Bucket) {
    const fileName = key.split("/").pop() || "";
    const assetCode = fileName.replace(/\.png$/i, "");

    return {
      key,
      url: `${env.publicApiBaseUrl}/api/assets/qr/${assetCode}`,
    };
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: `https://${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`,
  };
}

async function deleteObjectIfExists(key) {
  if (!key || !env.awsS3Bucket) {
    return;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: key,
    })
  );
}

module.exports = {
  uploadQrCodeBuffer,
  deleteObjectIfExists,
};
