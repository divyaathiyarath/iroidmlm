const mongoose = require('mongoose')
const Schema = mongoose.Schema
const driverNotificationSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    suburbs: [{
        type: Schema.Types.ObjectId,
        ref: "suburbs"
    }],
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    stock_transfer_id: {
        type: Schema.Types.ObjectId,
        ref: 'stock_transfers'
    },
    created_at: {
        type: Schema.Types.Date,
        default: new Date()
    },
    deleted_at: {
        type: Schema.Types.Date
    },
    delete_status: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ["JOB_SCHEDULE", "RETURN_TO_FACTORY", "FOOD_TRANSFER_REQUEST", "REFILLING", 'NOTIFICATION'],
        required: true
    }
});
module.exports = driver_notifications = mongoose.model('driver_notifications', driverNotificationSchema);