const mongoose = require('mongoose')
const Schema = mongoose.Schema
const addressSchema = new Schema({
    collectionpoint_id: {
        type: Schema.Types.ObjectId,
        ref: "collectionpoints"
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: "users"
    },
    company_id: {
        type: Schema.Types.ObjectId,
        ref: "companies"
    },
    type: {
        type: String,
        enum: ['USER', 'COLLECTION_POINT', 'BULK', 'OFFICE'],
        default: 'USER'
    },
    address_line2: {
        type: String
    },
    location: {
        coordinates: [Number], //should NOT be an empty array, should be with 2 number items such as [ -43.306174, -22.844279]
        type: {
            type: String,
            default: "Point"
        }
    },
    suburb_id: {
        type: Schema.Types.ObjectId,
        ref: "suburbs"
    },
    pincode: {
        type: String
    },
    address_line1: {
        type: String,
        required: true
    },
    house_flat_no: {  // unit
        type: String,
        trim: true
    },
    appartment: { // street number
        type: String,
        trim: true
    },
    landmark: { // street name
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
    contact_number: {
        type: String
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
        type: Date,
        default: Date.now()
    },
    delete_status: {
        type: Schema.Types.Boolean,
        default: false
    },
    deleted_at: {
        type: Schema.Types.Date
    }
});

addressSchema.index({location: "2dsphere"})

module.exports = addresses = mongoose.model('addresses', addressSchema);