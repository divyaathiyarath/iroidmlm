const mongoose = require('mongoose')
const Schema = mongoose.Schema
const cpStockSchema = new Schema({
    collectionpoint_id: {
        type: Schema.Types.ObjectId,
        ref: "collectionpoints"
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: "shifts"
    },
    date: {
        type: Schema.Types.Date
    },
    products: [{
        product_id: {
            type: Schema.Types.ObjectId,
            ref: "products"
        },
        stock: {
            type: Number,
            default: 0
        }
    }],
    delete_status:{
        type: Boolean,
        default:false
    }
});

module.exports = stocks = mongoose.model('cp_stocks', cpStockSchema);