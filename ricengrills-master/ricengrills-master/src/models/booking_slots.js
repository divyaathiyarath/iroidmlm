const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const moment = require("moment");

const bookingSlotSchema = new Schema({
  booking_id: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  shift_id: {
    type: Schema.Types.ObjectId,
  },
  driver_id: {
    type: Schema.Types.ObjectId,
    ref: "drivers",
  },
  address_id: {
    type: Schema.Types.ObjectId,
    ref: "addresses",
  },
  location: {
    coordinates: [Number], //should NOT be an empty array, should be with 2 number items such as [ -43.306174, -22.844279]
    type: {
      type: String,
      default: "Point",
    },
  },
  date: {
    type: Schema.Types.Date,
    default: Date.now(),
  },
  distance:{
    type: Number,
    default:0
  },
  order: {
    type: Number,
    default: 1,
  },
});

bookingSlotSchema.index({ location: "2dsphere" });
module.exports = booking_slots = mongoose.model(
  "booking_slots",
  bookingSlotSchema
);
