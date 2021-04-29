const mongoose = require("mongoose")
const Schema = mongoose.Schema

const moment = require("moment")
const driverLogSchema = new Schema({
    date: {
        type: Date,
        default: new Date(moment().format('YYYY-MM-DD'))
    },
    driver_id: {
        type: Schema.Types.ObjectId,
        ref: 'drivers'
    },
    shift_id: {
        type: Schema.Types.ObjectId,
        ref: 'settings.shift'
    },
    // suburb_id: {
    //     type: Schema.Types.ObjectId,
    //     ref: 'suburbs'
    // },
    service_start_time: {
        type: Date,
        default: null
    },
    service_start_location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: [Number]
    },
    service_end_time: {
        type: Date,
        default: null
    },
    serivce_end_location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: [Number]
    },
    dedicated_start_time: {
        type: Date,
        default: null
    },
    dedicated_start_location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: [Number]
    },
    callback_time: {
        type: Date,
        default: null
    },
    delivered_items: [{
        delivered_user: {
            type: Schema.Types.ObjectId,
            ref: 'users'
        },
        name: {
            type: String,
        },
        image: {
            type: String,
            required: true,
        },
        cover_pic: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["FOOD", "ACCESSORIES"],
            default: "FOOD",
        },
        allergen_contents: {
            type: [String],
        },
        is_veg: {
            type: Boolean,
        },
        quantity: {
            type: Number
        }
    }],
})

module.exports = driver_logs = mongoose.model("driver_logs", driverLogSchema)