const mongoose = require('mongoose')
const Schema = mongoose.Schema
const suburbSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
    },
    radius: {
        type: Schema.Types.Number
    },
    location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: [Number]
    },
    active: {
        type: Boolean,
        default: true
    },
    delete_status: {
        type: Schema.Types.Boolean,
        default: false
    },
    deleted_at: {
        type: Schema.Types.Date
    },
    has_realtime_order: {             // Check has scheduled orer delivery
        type: Schema.Types.Boolean,
        default: false
    },
    has_online_delivery: {
        type: [                       // Check has realtime order delivery 
            Schema.Types.ObjectId
        ],
        default: []
    }
});
suburbSchema.index({ location: "2dsphere" })
module.exports = suburbs = mongoose.model('suburbs', suburbSchema);