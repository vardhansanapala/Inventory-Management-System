const { Schema, model } = require("mongoose");

const CounterSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    sequenceValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const Counter = model("Counter", CounterSchema);

module.exports = {
  Counter,
};

