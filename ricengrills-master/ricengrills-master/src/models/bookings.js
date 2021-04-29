const mongoose = require('mongoose')
const Schema = mongoose.Schema
const moment = require('moment')

const orderSchema = new Schema({
    product_id: {
        type: Schema.Types.ObjectId,
        ref: 'products'
    },
    quantity: {
        type: Number
    },
    price: {
        type: Number
    }
})
const bookingSchema = new Schema({
    booking_id: {
        type: String, // Booking id generated eg: RNG-SCHBKNG-1000
        required: true
    },
    payment_id: {
        type: Schema.Types.ObjectId,
        ref: 'payments'
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    company_id: {
        type: Schema.Types.ObjectId,
        ref: 'companies'
    },
    booking_type: {
        type: String,
        enum: ['REALTIME', 'SCHEDULED', 'BULK'],
        default: 'REALTIME'
    },
    delivery_type: {
        type: String,
        enum: ['ONLINE', 'COLLECTIONPOINT']
    },
    collectionpoint_id: {
        type: Schema.Types.ObjectId,
        ref: 'collectionpoints'
    },
    address_id: {
        type: Schema.Types.ObjectId,
        ref: 'addresses'
    },
    scheduled_date: {
        type: Date,
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        // ref: 'settings.shift_times'
    },
    orders: [orderSchema],
    qrcode: {
        type: String
    },
    redeemed: {
        type: Boolean,
        default: false
    },
    delivered_time: {
        type: Date,
    },
    delivered_by: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    delivered_as: {
        type: String,
        enum: ['DOORSTEP', 'ONHAND']
    },
    service_rating: {
        type: Number
    },
    food_rating: {
        type: Number
    },
    coupon: {
        type: String,
    },
    notification_flag: {
        type: Boolean,
        default: false
    },
    delete_status: {
        type: Boolean,
        default: false,
    },
    created_at: {
        type: Date,
        default: new Date()
    },
    updated_at: {
        type: Date
    },
    deleted_at: {
        type: Date
    },
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    break_time: {
        type: String,
        default: ""
    }
})
module.exports = bookings = mongoose.model('bookings', bookingSchema)