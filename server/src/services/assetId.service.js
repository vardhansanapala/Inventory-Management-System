const { Counter } = require("../models/Counter");
const { Product } = require("../models/Product");
const { Category } = require("../models/Category");
const { ApiError } = require("../utils/ApiError");

const ASSET_COUNTER_KEY = "asset-sequence";
const PREFIX_OVERRIDES = {
  LAPTOP: "LAP",
  MOBILE: "MOB",
};

function normalizePrefixSource(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function derivePrefix(category) {
  const normalizedCode = normalizePrefixSource(category?.code);
  const normalizedName = normalizePrefixSource(category?.name);
  const mappedPrefix = PREFIX_OVERRIDES[normalizedCode] || PREFIX_OVERRIDES[normalizedName];

  if (mappedPrefix) {
    return mappedPrefix;
  }

  const fallbackSource = normalizedCode || normalizedName;
  if (!fallbackSource) {
    throw new ApiError(400, "Unable to derive an asset ID prefix from the product category");
  }

  const compact = fallbackSource.replace(/_/g, "");
  return compact.slice(0, 3).padEnd(3, "X");
}

function formatAssetId(prefix, sequenceValue) {
  return `${prefix}-${String(sequenceValue).padStart(6, "0")}`;
}

async function resolveCategoryForDocument(document, session) {
  const productId = document?.product?._id || document?.product;
  if (!productId) {
    throw new ApiError(400, "productId is required before generating an asset ID");
  }

  let productCategory = document?.product?.category || null;

  if (!productCategory) {
    const productQuery = Product.findById(productId).populate("category");
    if (session) {
      productQuery.session(session);
    }
    const product = await productQuery;

    if (!product?.category) {
      throw new ApiError(400, "Unable to resolve the product category for asset ID generation");
    }

    productCategory = product.category;
  } else if (!productCategory.name && !productCategory.code) {
    const categoryQuery = Category.findById(productCategory);
    if (session) {
      categoryQuery.session(session);
    }
    const category = await categoryQuery;
    if (!category) {
      throw new ApiError(400, "Unable to resolve the product category for asset ID generation");
    }

    productCategory = category;
  }

  return productCategory;
}

async function allocateAssetIdForPrefix(prefix, session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: `${ASSET_COUNTER_KEY}:${prefix}` },
    {
      $inc: { sequenceValue: 1 },
    },
    {
      new: true,
      upsert: true,
      session,
      setDefaultsOnInsert: true,
    }
  );

  return formatAssetId(prefix, counter.sequenceValue);
}

async function allocateAssetId(document, session) {
  const category = await resolveCategoryForDocument(document, session);
  const prefix = derivePrefix(category);
  return allocateAssetIdForPrefix(prefix, session);
}

async function ensureAssetId(document, session) {
  if (document.assetId) {
    return document.assetId;
  }

  const resolvedSession = session || document.$session?.();
  const assetId = await allocateAssetId(document, resolvedSession);
  document.assetId = assetId;
  return assetId;
}

module.exports = {
  allocateAssetId,
  allocateAssetIdForPrefix,
  ensureAssetId,
  formatAssetId,
};
