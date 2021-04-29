const mongoose = require('mongoose')
const Schema = mongoose.Schema
const notificationSchema = new Schema({
    shift_id: {
        type: Schema.Types.ObjectId,
        required: true
    },
    date: {
        type: Schema.Types.Date
    },
    created_at: {
        type: Schema.Types.Date,
        default: Date.now()
    },
    deleted_at: {
        type: Schema.Types.Date
    },
    delete_status: {
        type: Boolean,
        default: false
    },
    accepted_drivers: {
        type: [Schema.Types.ObjectId],
        ref: "drivers"
    },
    rejected_drivers: {
        type: [Schema.Types.ObjectId],
        ref: "drivers"
    },
    approved_drivers: {
        type: [Schema.Types.ObjectId],
        ref: "drivers"
    }
});
module.exports = job_notifications = mongoose.model('job_notifications', notificationSchema);