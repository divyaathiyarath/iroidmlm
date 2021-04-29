const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const excessStockSchema = new Schema({
  shift_id: {
    type: Schema.Types.ObjectId,
    ref: "types",
  },
  collectionpoint_id: {
    type: Schema.Types.ObjectId,
    ref: "collectionpoints",
  },
  products: [
    {
      product_id: {
        type: Schema.Types.ObjectId,
        ref: "products",
      },
      quantity: {
        type: Number,
        default: 0,
      },
    },
  ],
  delete_status: {
    type: Boolean,
    default: false,
  },
  deleted_at: {
    type: Date,
  },
});
module.exports = suburbs = mongoose.model("excessstocks", excessStockSchema);
