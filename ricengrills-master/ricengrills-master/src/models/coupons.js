const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  val: {
    type: Number,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
    default: null,
  },
  active_status: {
    type: Boolean,
    default: true
  },
  suburbs: {
    type: [Schema.Types.ObjectId],
    ref: 'suburbs',
    default : []
  },
  created_at: {
    type: Date,
    default: Date.now()
  },
  updated_at: {
    type: Date
  },
  delete_status: {
    type: Schema.Types.Boolean,
    default: false,
  },
});

module.exports = coupons = mongoose.model("coupons", couponSchema);
