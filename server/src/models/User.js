const { Schema, model } = require("mongoose");
const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");

const UserSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    employeeCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      default: undefined,
      set: (value) => {
        const normalized = String(value || "").trim();
        return normalized || undefined;
      },
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.EMPLOYEE,
    },
    passwordHash: {
      type: String,
      default: "",
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUSES),
      default: USER_STATUSES.ACTIVE,
      index: true,
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

UserSchema.virtual("fullName").get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

const User = model("User", UserSchema);

module.exports = {
  User,
};
