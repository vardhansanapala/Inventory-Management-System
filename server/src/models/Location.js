const { Schema, model } = require("mongoose");

const LocationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["OFFICE", "WAREHOUSE", "OUTSIDE", "SERVICE_CENTER"],
      default: "OFFICE",
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Location = model("Location", LocationSchema);

module.exports = {
  Location,
};

