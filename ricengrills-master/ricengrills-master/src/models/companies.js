const mongoose = require("mongoose");
const crypto = require("crypto");
const Schema = mongoose.Schema;
const companySchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  mobile: {
    type: String,
  },
  delete_status: {
    type: Schema.Types.Boolean,
    default: false,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "users"
  }
});

module.exports = companies = mongoose.model(
  "companies",
  companySchema
);
