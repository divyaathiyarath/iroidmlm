const mongoose = require('mongoose')
const Schema = mongoose.Schema
const profileSchema = new Schema({
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: "drivers"
    },
    image: {
        type: String,
        default: null
    },
    registration_number: {
        type: String,
        required: true
    },
    insurance: {
        type: String,
        required: true
    },
    insurance_validity: {
        type: Schema.Types.Date,
        required: true
    },
    type: {
        type: String,
        enum: [
            'REFILLING', 'DELIVERY'
        ],
        default: "DELIVERY"
    },
    delete_status: {
        type: Schema.Types.Boolean,
        default: false
    }
});

module.exports = profile = mongoose.model('profiles', profileSchema);