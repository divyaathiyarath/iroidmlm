const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  product_id: {
    type: Schema.Types.ObjectId,
    ref: "products",
  },
  quantity: {
    type: Number,
  },
  price: {
    type: Number,
  },
});

const tmpBookingSchema = new Schema({
  tmp_payment_id: {
    type: Schema.Types.ObjectId,
    ref: "tmp_payments",
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  company_id: {
    type: Schema.Types.ObjectId,
    ref: "companies",
  },
  booking_type: {
    type: String,
    enum: ["REALTIME", "SCHEDULED", "BULK"],
    default: "REALTIME",
  },
  delivery_type: {
    type: String,
    enum: ["ONLINE", "COLLECTIONPOINT"],
  },
  collectionpoint_id: {
    type: Schema.Types.ObjectId,
    ref: "collectionpoints",
  },
  address_id: {
    type: Schema.Types.ObjectId,
    ref: "addresses",
  },
  scheduled_date: {
    type: Date,
    default: Date.now(),
  },
  scheduled_time: {
    type: String,
  },
  shift_id: {
    type: Schema.Types.ObjectId,
    ref: "settings",
  },
  orders: [orderSchema],
  product_id: {
    type: Schema.Types.ObjectId,
    ref: "products",
  },
  quantity: {
    type: Number,
  },
  price: {
    type: Number,
  },
  date: {
    type: Date,
  },
  coupon: {
    type: String,
    default: null,
  },
  approximate_price: {
    type: String,
  },
  bulkorder_status: {
    type: String,
    enum: ["REJECTED", "PENDING", "APPROVED"],
    default: "PENDING",
  },
  bulkorder_review: {
    type: String,
  },
  delete_status: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now(),
  },
  updated_at: {
    type: Date,
  },
  deleted_at: {
    type: Date,
  },
  driver_id: {
    type: Schema.Types.ObjectId,
    ref: "drivers",
  },
  booking_id: {
    type: String,
    ref: "bookings",
  },
});

module.exports = tmp_bookings = mongoose.model(
  "tmp_bookings",
  tmpBookingSchema
);
