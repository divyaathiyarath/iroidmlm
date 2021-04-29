const mongoose = require('mongoose')
const Schema = mongoose.Schema
const shiftSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    icon: {
        type: String
    }
})
const settingsSchema = new Schema({
    shift_times: [shiftSchema],
    price: {
        food: {
            type: Number,
            default: 3
        },
        accessories: {
            type: Number,
            default: 1.5
        }
    },
    gst: {
        type: Number,
        default: 1
    },
    min_bulk_order_quantity: {
        type: Number,
        default: 100
    },
    delivery_charge: {
        type: Number,
        default: 1.5
    },
    per_hour_charge: {
        type: Number,
        default: 1.5
    },
    per_order_charge: {
        type: Number,
        default: 1.5
    },
    office_mobile: {
        type: String
    },
    service_charge_paypal: {
        type: Number,
        default: 0
    },
    service_charge_square: {
        type: Number,
        default: 0
    },
    min_schedule_hour: {
        type: Number,
        default: 0
    },
    cp_commission_per_item: {
        type: Number,
        default: 0
    },
    android_version: {
        type: Number,
        default: 1.00
    },
    ios_version: {
        type: Number,
        default: 1.00
    }
});

module.exports = products = mongoose.model('settings', settingsSchema);