const mongoose = require('mongoose')
const Schema = mongoose.Schema
const paymentSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    transaction_id: {
        type: String,
    },
    checkout_id: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now()
    },
    actual_price: {
        type: Number
    },
    discount_price: {
        type: Number
    },
    gst: {
        type: Number
    },
    delivery_charge: {
        type: Number,
        default: 0
    },
    total_price: {
        type: Number
    },
    credit_used: {
        type: Number,
        default: 0
    },
    payment_type: {
        type: String,
        enum: ['COD', 'ONLINE'],
    },
    is_credit: {
        type: Boolean,
        default: false,
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    service_charge:{
        type: Number,
        default: 0
    },
    gateway:{
        type: String,
        default: ""
    }
})

module.exports = payments = mongoose.model('payments', paymentSchema);