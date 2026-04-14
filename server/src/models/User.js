const { Schema, model } = require("mongoose");
const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");
const { PERMISSIONS } = require("../constants/permissions");

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
    permissions: {
      type: [String],
      enum: Object.values(PERMISSIONS),
      default: [],
      index: true,
    },
    manageableRoles: {
      type: [String],
      enum: Object.values(USER_ROLES),
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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
