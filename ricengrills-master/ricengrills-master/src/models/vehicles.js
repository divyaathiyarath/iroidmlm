const mongoose = require('mongoose')
const Schema = mongoose.Schema
const vehicleSchema = new Schema({
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
    },
    insurance: {
        type: String,
    },
    insurance_validity: {
        type: Schema.Types.Date,
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

module.exports = vehicles = mongoose.model('vehicles', vehicleSchema);