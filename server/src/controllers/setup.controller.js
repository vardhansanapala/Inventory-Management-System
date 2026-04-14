const { Category } = require("../models/Category");
const { Location } = require("../models/Location");
const { Product } = require("../models/Product");
const { User } = require("../models/User");
const { USER_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");
const { toPublicUser } = require("../utils/userSerializer");

async function getSetupBootstrap(_req, res) {
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

  res.json({
    categories,
    products,
    locations,
    users: users.map(toPublicUser),
  });
}

async function createCategory(req, res) {
  const category = await Category.create({
    name: req.body.name,
    code: req.body.code,
    description: req.body.description,
  });

  res.status(201).json(category);
}

async function createLocation(req, res) {
  const location = await Location.create({
    name: req.body.name,
    code: req.body.code,
    type: req.body.type,
    address: req.body.address,
  });

  res.status(201).json(location);
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

module.exports = {
  getSetupBootstrap,
  createCategory,
  createLocation,
  createProduct,
};
