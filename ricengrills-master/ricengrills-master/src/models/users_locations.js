const mongoose = require('mongoose')
const Schema = mongoose.Schema

const usersLocationSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    location_name: {
        type: String,
        trim: true
    },
    location:{
        type:{
            type:String,
            default:"Point"
        },
        coordinates:[Number]
    },
    house_flat_no: {
        type: String,
        trim: true
    },
    appartment: {
        type: String,
        trim: true
    },
    landmark: {
        type: String,
        trim: true
    },
    to_reach: {
        type: String,
        trim: true
    },
    contact_person: {
        type: String,
        trim: true
    },
    address_type: {
        type: String,
        enum: ['HOME', 'OFFICE', 'OTHERS'],
        default: 'HOME'
    },
    active_location: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    updated_at: {
        type: Date
    },
    deleted_at: {
        type: Date
    },
    delete_status: {
        type: Boolean,
        default: false
    }
})

module.exports = users_locations = mongoose.model('users_locations', usersLocationSchema)