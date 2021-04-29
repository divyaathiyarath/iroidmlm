const mongoose = require("mongoose")
const Schema = mongoose.Schema
const driverAlertSchema = new Schema({
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    reason: {
        type: String
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: 'settings.shifts'
    },
    location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: [Number]
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    delete_status: {
        type: Boolean,
        default: false
    },
    deleted_at: {
        type: Date
    }
})

module.exports = driver_alerts = mongoose.model("driver_alerts", driverAlertSchema)