const mongoose = require('mongoose')
const Schema = mongoose.Schema
const creditSchema = new Schema({
    checkout_id: {
        type: String
    },
    order_id: {
        type: String
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    date: {
        type: Date,
        default: Date.now()
    },
    price: {
        type: Number
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    deleted_at: {
        type: Date,
    }
})

module.exports = credits = mongoose.model('credits', creditSchema);