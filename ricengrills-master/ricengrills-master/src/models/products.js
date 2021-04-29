const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const productSchema = new Schema({
  name: {
    type: String,
  },
  image: {
    type: String,
    required: true,
  },
  cover_pic: {
    type: String,
    default: null,
  },
  price: {
    type: Number,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["FOOD", "ACCESSORIES"],
    default: "FOOD",
  },
  allergen_contents: {
    type: [String],
  },
  is_veg: {
    type: Boolean,
  },
  is_regular: {
    type: Boolean,
    default: true,
  },
  rating: {
    type: Number,  // Note :- Rating calculated by (rating / total_ratings)
    default: 5
  },
  total_ratings: {
    type: Number,
    default: 1
  },
  delete_status: {
    type: Schema.Types.Boolean,
    default: false,
  },
  deleted_at: {
    type: Schema.Types.Date,
  },
  container_size: {
    type: String
  },
  ingredients: {
    type: String
  },
  description: {
    type: String
  },
});

module.exports = products = mongoose.model("products", productSchema);
