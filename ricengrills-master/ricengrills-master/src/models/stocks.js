const mongoose = require('mongoose')
const Schema = mongoose.Schema
const stockSchema = new Schema({
    suburb_id: {
        type: Schema.Types.ObjectId,
        ref: "suburbs"
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: "shifts"
    },
    date: {
        type: Schema.Types.Date
    },
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: "drivers"
    },
    vehicle_id: {
        type: Schema.Types.ObjectId,
        ref: "vehicles"
    },
    type: {
        type: String,
        enum: ['REFILLING', 'DELIVERY', 'BULK']
    },
    boxes: [{
        type: Schema.Types.ObjectId,
        ref: "boxes"
    }],
    products: [{
        product_id: {
            type: Schema.Types.ObjectId,
            ref: "products"
        },
        stock: {
            type: Number,
            default: 0
        },
        box_id: {
            type: Schema.Types.ObjectId
        }
    }],
    initial_stock: [{
        product_id: {
            type: Schema.Types.ObjectId,
            ref: "products"
        },
        stock: {
            type: Number,
            default: 0
        },
        box_id: {
            type: Schema.Types.ObjectId
        }
    }],
    delete_status:{
        type: Boolean,
        default:false
    },
    transfer_status: {
        type: Boolean,
        default: false,
    }
});

module.exports = stocks = mongoose.model('stocks', stockSchema);