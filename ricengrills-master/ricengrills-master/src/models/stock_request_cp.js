const mongoose = require('mongoose')
const Schema = mongoose.Schema
const requestSchena = new Schema({
    collectionpoint_id: {
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
    products: [
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
    },
    delete_status:{
        type:Boolean,
        default:false
    },
    deleted_at:{
        type:Number
    }
})

module.exports = stock_requests_cp = mongoose.model('stock_requests_cp', requestSchena);