const mongoose = require('mongoose')
const Schema = mongoose.Schema

const cpSalesSchema = new Schema({
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
    booking_id: {
        type: String, // Booking id generated eg: RNG-SCHBKNG-1000
        required: true
    },
    total:{
        type:Number,
        required:true
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
})

module.exports = sales = mongoose.model("cp_sales",cpSalesSchema)