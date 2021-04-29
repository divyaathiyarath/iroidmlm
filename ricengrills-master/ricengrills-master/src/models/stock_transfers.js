const mongoose = require('mongoose')
const Schema = mongoose.Schema
const moment = require('moment')

const stockTransferSchema = new Schema({
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    collectionpoint_id: {
        type: Schema.Types.ObjectId,
        ref: 'collectionpoints'
    },
    type: {
        type: String,
        enum: ['STOCKIN', 'STOCKOUT', 'CALLBACK', 'REFILLING', 'COLLECTIONPOINT', 'RETURNFACTORY']
    },
    to_driver_id: {
        type: Schema.Types.ObjectId,
        ref: drivers
    },
    products: [
        {
            product_id: {
                type: Schema.Types.ObjectId,
                ref: 'products'
            },
            stock: {
                type: Number
            }
        }
    ],
    date: {
        type: Date,
        default: Date.now()
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    approve_status: {
        type: Boolean,
        default: false
    },
    suburb_id: {
        type: Schema.Types.ObjectId,
        ref: 'suburbs'
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: 'settings.shift_times'
    },
    delivered_status: {
        type: String,
        enum: ['TRANSFERRED', 'RECEIVED', 'PENDING'],
        default: 'PENDING'
    },
    transferred_at: {
        type: Date,
    },
    received_at: {
        type: Date
    }
})

module.exports = stock_transfers = mongoose.model("stock_transfers", stockTransferSchema)