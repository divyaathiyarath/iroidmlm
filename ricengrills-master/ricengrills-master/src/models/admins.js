const mongoose = require('mongoose')
const crypto = require('crypto')
const Schema = mongoose.Schema
const adminsSchema = new Schema({
    name: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true
    },
    mobile: {
        type: String,
        trim: true
    },
    hash: {
        type: String
    },
    salt: {
        type: String
    },
    role: {
        type: String,
        enum: ['SUPERADMIN', 'ADMIN'],
        default: 'ADMIN'
    },
    otp: {
        type: String,
    },
    is_admin: {
        type: Boolean,
        default: true
    },
    online_status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'INACTIVE',
    },
    image: {
        type: String,
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    updated_at: {
        type: Date,
    },
    deleted_at: {
        type: Date,
    },
    delete_status: {
        type: Boolean,
        default: false
    },
    token: {
        type: String
    },
    token_expiry: {
        type: Date
    },
    device_token: {
        type: String
    }
});

adminsSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString("hex");
    this.hash = crypto
        .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
        .toString("hex")
}

adminsSchema.methods.validatePassword = function (password) {
    const hash = crypto
        .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
        .toString("hex");
    return this.hash === hash
}

module.exports = admins = mongoose.model('admins', adminsSchema);