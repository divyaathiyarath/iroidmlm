const mongoose = require("mongoose");
const crypto = require("crypto");
const Schema = mongoose.Schema;
const cpSchema = new Schema({
  name: {
    type: String,
  },
  image: {
    type: String,
  },
  contact_name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  hash: {
    type: String,
  },
  salt: {
    type: String,
  },
  otp: {
    type: String,
  },
  description: {
    type: String,
  },
  approved: {
    type: Schema.Types.Boolean,
    default: false
  },
  rejected: {
    type: Schema.Types.Boolean,
    default: false
  },
  hash: {
    type: String,
  },
  salt: {
    type: String,
  },
  token: String,
  token_expiry: Date,
  delete_status: {
    type: Schema.Types.Boolean,
    default: false,
  },
  deleted_at: {
    type: Schema.Types.Date,
  },
  starttime:{
    type:String
  },
  closetime:{
    type:String
  }
});

cpSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
};

cpSchema.methods.validatePassword = function (password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
  return this.hash === hash;
};

module.exports = collectionpoints = mongoose.model(
  "collectionpoints",
  cpSchema
);
