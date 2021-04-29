const moment = require('moment');
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const transactionSchema = new Schema({
    user_id: {
        type:Schema.Types.ObjectId,
        required:true
    },
    booking_id: {
        type: String,
        ref: "bookings"
    },
    payment_id: {
        type: String        
    },
    amount: {
        type: Number,
        default: 0
    },
    refund_amount: {
        type: Number,
        default: 0
    },
    refund_status: {
        type: Schema.Types.Boolean,
        default: false
    },
    type:{
        type:String,
        enum:["RNG-CREDITS","ORDER"]
    },
    date: {
        type:Date,
        default: Date.now()
    },
    gateway:{
        type: String, // #paypal & #squre
        default: ""
    }
})

module.exports = transactions = mongoose.model('transactions', transactionSchema);