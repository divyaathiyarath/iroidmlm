const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const scheduledStockLimit = new Schema({
    suburb_id: {
        type: Schema.Types.ObjectId,
        ref: 'suburbs'
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: 'settings.shift_times'
    },
    product_id: {
        type: Schema.Types.ObjectId,
        ref: 'products'
    },
    limit: {
        type: Number,
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    updated_at: {
        type: Date,
    },
    delete_status: {
        type: Boolean,
        default: false,
    },
    deleted_at: {
        type: Date
    }
});
module.exports = suburbs = mongoose.model("scheduled_stock_limits", scheduledStockLimit);
