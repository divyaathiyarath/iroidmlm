const mongoose = require('mongoose')
const Schema = mongoose.Schema
const TempSchema = new Schema({
    stock_ids: [{
        type: Schema.Types.ObjectId,
        ref: "stocks"
    }],
    box_id: {
        type: Schema.Types.ObjectId,
        ref: "boxes"
    },
    sensor_id: {
        type: Schema.Types.ObjectId,
        ref: "sensors"
    },
    sensor_uid: String,
    temperature: Number,
    date: {
        type: Date,
        default: Date.now()
    },
    shift_id: {
        type: Schema.Types.ObjectId
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: "users"
    }
});
module.exports = suburbs = mongoose.model('temp_logs', TempSchema);