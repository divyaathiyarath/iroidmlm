const mongoose = require('mongoose')
const crypto = require('crypto')
const Schema = mongoose.Schema
const jwt = require("jsonwebtoken");
const { stringify } = require('querystring');

const driverSchema = new Schema({
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
        trim: true,
    },
    address: {
        type: String,
        trim: true
    },
    hash: {
        type: String
    },
    salt: {
        type: String
    },
    otp: {
        type: String,
        default: null
    },
    token: {
        type: String,
    },
    online_status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'INACTIVE',
    },
    image: {
        type: String,
    },
    age_confirm: {
        type: Schema.Types.Boolean,
        default: false
    },
    has_car: {
        type: Schema.Types.Boolean,
        default: false
    },
    license_number: {
        type: String,
    },
    police_clearance: {
        type: String,
    },
    driving_license: {
        type: String,
    },
    license_expiry: {
        type: Date,
    },
    profile_completed: {
        type: Schema.Types.Boolean,
        default: false
    },
    is_approved: {
        type: Schema.Types.Boolean,
        default: false
    },
    is_rejected: {
        type: Schema.Types.Boolean,
        default: false
    },
    admin_review: {
        type: String,
    },
    resubmitted: {
        type: Boolean,
        default: false,
    },
    resubmitted_at: {
        type: Date
    },
    rating: {
        type: Number
    },
    total_ratings: {
        type: Number
    },
    created_by: {
        type: String,
        enum: ['ADMIN', 'ONLINE'],
        default: 'ADMIN'
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
    type: {
        type: String,
        enum: ['REFILLING', 'DELIVERY'],
        default: 'DELIVERY',
    },
    vehicle_id: {
        type: Schema.Types.ObjectId,
        ref: 'vehicles'
    },
    location: {
        type: {
            type: String,
            default: "Point"
        },
        // coordinates: [Number]
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    device_token: {
        type: String,
        default: null
    },
    abn_number: {
        type: String,
    }
});

driverSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString("hex");
    this.hash = crypto
        .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
        .toString("hex")
}

driverSchema.methods.validatePassword = function (password) {
    const hash = crypto
        .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
        .toString("hex");
    return this.hash === hash
}

driverSchema.methods.generateJWT = function () {
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

driverSchema.methods.toAuthJSON = function () {
    return {
        _id: this._id,
        email: this.email,
        mobile: this.mobile,
        profile_completed: this.profile_completed,
        is_approved: this.is_approved,
        is_rejected: this.is_rejected,
        admin_review: this.admin_review,
        token: this.generateJWT(),
    };
};

driverSchema.index({ location: "2dsphere" })

module.exports = drivers = mongoose.model('drivers', driverSchema);