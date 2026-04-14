const { Category } = require("../models/Category");
const { Location } = require("../models/Location");
const { Product } = require("../models/Product");
const { User } = require("../models/User");
const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");
const { toPublicUser } = require("../utils/userSerializer");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

async function getSetupBootstrap(req, res) {
  const [categories, products, locations, users] = await Promise.all([
    Category.find({ isDeleted: false }).sort({ name: 1 }),
    Product.find({ isDeleted: false }).populate("category").sort({ sku: 1 }),
    Location.find({ isDeleted: false }).sort({ name: 1 }),
    User.find({
      isDeleted: false,
      isActive: true,
      status: { $in: [USER_STATUSES.ACTIVE, null] },
    }).sort({ firstName: 1, lastName: 1 }),
  ]);

  if (req.user.role === USER_ROLES.ADMIN) {
    return res.json({
      categories,
      products,
      locations: [],
      users: [],
    });
  }

  res.json({
    categories,
    products,
    locations,
    users: users.map(toPublicUser),
  });
}

async function createCategory(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage categories");
  }

  const category = await Category.create({
    name: normalizeUpper(req.body.name),
    code: normalizeUpper(req.body.name),
    description: normalizeText(req.body.description),
  });

  res.status(201).json(category);
}

async function updateCategory(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage categories");
  }

  const category = await Category.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  if (req.body.name !== undefined) {
    const nextName = normalizeUpper(req.body.name);
    if (!nextName) {
      throw new ApiError(400, "Category name is required");
    }
    category.name = nextName;
    category.code = nextName;
  }

  if (req.body.description !== undefined) {
    category.description = normalizeText(req.body.description);
  }

  await category.save();
  res.json(category);
}

async function createLocation(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage locations");
  }

  const location = await Location.create({
    name: normalizeText(req.body.name),
    code: normalizeUpper(req.body.code),
    type: req.body.type,
    address: normalizeText(req.body.address),
  });

  res.status(201).json(location);
}

async function updateLocation(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage locations");
  }

  const location = await Location.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!location) {
    throw new ApiError(404, "Location not found");
  }

  if (req.body.name !== undefined) {
    const nextName = normalizeText(req.body.name);
    if (!nextName) {
      throw new ApiError(400, "Location name is required");
    }
    location.name = nextName;
  }

  if (req.body.code !== undefined) {
    const nextCode = normalizeUpper(req.body.code);
    if (!nextCode) {
      throw new ApiError(400, "Location code is required");
    }
    location.code = nextCode;
  }

  if (req.body.type !== undefined) {
    location.type = req.body.type;
  }

  if (req.body.address !== undefined) {
    location.address = normalizeText(req.body.address);
  }

  await location.save();
  res.json(location);
}

async function createProduct(req, res) {
  const category = await Category.findOne({
    _id: req.body.categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(400, "Invalid category reference");
  }

  const product = await Product.create({
    category: req.body.categoryId,
    brand: req.body.brand,
    model: req.body.model,
    sku: req.body.sku,
    description: req.body.description,
  });

  const populated = await Product.findById(product._id).populate("category");
  res.status(201).json(populated);
}

async function updateProduct(req, res) {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  }).populate("category");

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (req.body.categoryId !== undefined) {
    const category = await Category.findOne({
      _id: req.body.categoryId,
      isDeleted: false,
    });

    if (!category) {
      throw new ApiError(400, "Invalid category reference");
    }

    product.category = category._id;
  }

  if (req.body.brand !== undefined) {
    product.brand = normalizeText(req.body.brand);
  }

  if (req.body.model !== undefined) {
    product.model = normalizeText(req.body.model);
  }

  if (req.body.sku !== undefined) {
    product.sku = normalizeUpper(req.body.sku);
  }

  if (req.body.description !== undefined) {
    product.description = normalizeText(req.body.description);
  }

  await product.save();

  const populated = await Product.findById(product._id).populate("category");
  res.json(populated);
}

async function deleteCategory(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage categories");
  }

  const category = await Category.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const activeProducts = await Product.countDocuments({
    category: category._id,
    isDeleted: false,
  });

  if (activeProducts > 0) {
    throw new ApiError(400, "Cannot delete a category that still has active products");
  }

  category.isDeleted = true;
  await category.save();

  res.json({ message: "Category deleted successfully" });
}

async function deleteLocation(req, res) {
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can manage locations");
  }

  const location = await Location.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!location) {
    throw new ApiError(404, "Location not found");
  }

  location.isDeleted = true;
  await location.save();

  res.json({ message: "Location deleted successfully" });
}

async function deleteProduct(req, res) {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.isDeleted = true;
  await product.save();

  res.json({ message: "Product deleted successfully" });
}

module.exports = {
  getSetupBootstrap,
  createCategory,
  updateCategory,
  deleteCategory,
  createLocation,
  updateLocation,
  deleteLocation,
  createProduct,
  updateProduct,
  deleteProduct,
};
