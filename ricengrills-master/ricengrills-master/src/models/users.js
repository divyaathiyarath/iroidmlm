const mongoose = require("mongoose");
const crypto = require("crypto");
const Schema = mongoose.Schema;
const jwt = require("jsonwebtoken");

const usersSchema = new Schema({
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  mobile: {
    type: String,
    trim: true,
  },
  hash: {
    type: String,
  },
  salt: {
    type: String,
  },
  otp: {
    type: String,
    default: null,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  token: {
    type: String,
  },
  online_status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE"],
    default: "INACTIVE",
  },
  profile_pic: {
    type: String,
    default: null,
  },
  credits: {
    food: {
      type: Number,
      default: 0
    },
    accessories: {
      type: Number,
      default: 0
    }
  },
  refferal_code: {
    type: String,
  },
  reffered_by: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  company_id:{
    type: Schema.Types.ObjectId,
    ref: 'companies'
  },
  active_status: {
    type: Boolean,
    default: true,
  },
  first_order: {
    type: Boolean,
    default: true,
  },
  device_token: {
      type: String,
      default: null
  },
  notification_read_status: {
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
  delete_status: {
    type: Boolean,
    default: false,
  },
});

usersSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
};

usersSchema.methods.validatePassword = function (password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
  return this.hash === hash;
};

usersSchema.methods.generateJWT = function () {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + 60);

  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      mobile: this.mobile,
      exp: parseInt(expirationDate.getTime() / 1000, 10),
    },
    "secret"
  );
};

usersSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    email: this.email,
    mobile: this.mobile,
    credits: this.credits,
    notification_read_status: this.notification_read_status,
    refferal_code: this.refferal_code,
    first_order: this.first_order,
    token: this.generateJWT(),
  };
};

module.exports = users = mongoose.model("users", usersSchema);
