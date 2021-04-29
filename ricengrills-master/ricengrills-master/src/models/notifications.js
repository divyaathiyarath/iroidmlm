const mongoose = require('mongoose')
const Schema = mongoose.Schema
const notificationSchema = new Schema({
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
    suburbs:[{
        type: Schema.Types.ObjectId,
        ref: "suburbs"
    }],
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    created_at:{
        type: Schema.Types.Date,
        default: new Date()
    },
    deleted_at:{
        type: Schema.Types.Date
    },
    delete_status:{
        type:Boolean,
        default:false
    }
});
module.exports = notifications = mongoose.model('notifications', notificationSchema);