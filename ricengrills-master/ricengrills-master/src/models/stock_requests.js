const mongoose = require('mongoose')
const Schema = mongoose.Schema
const requestSchena = new Schema({
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    date: {
        type: Date,
        default: Date.now()
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: 'settings.shift_id'
    },
    requests: [
        {
            product_id: {
                type: Schema.Types.ObjectId,
                ref: 'products'
            },
            quantity: {
                type: Number
            }
        }
    ],
    approve_status: {
        type: Boolean,
        default: false
    }
})

module.exports = stock_requests = mongoose.model('stock_requests', requestSchena);