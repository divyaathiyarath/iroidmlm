const mongoose = require('mongoose')
const Schema = mongoose.Schema
const boxesSchema = new Schema({
    uid: {
        type: String,
        required: true
    },
    sensor_id: {
        type: Schema.Types.ObjectId,
        ref: 'sensors'
    },
    delete_status: {
        type: Schema.Types.Boolean,
        default: false
    },
    deleted_at: {
        type: Schema.Types.Date
    }
});

module.exports = boxes = mongoose.model('boxes', boxesSchema);