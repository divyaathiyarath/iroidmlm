const mongoose = require('mongoose')

const Schema = mongoose.Schema
const ratingSchema = new Schema({
    booking_id: {
        type: Schema.Types.ObjectId,
        ref: 'bookings'
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    rating: {
        type: Number
    }
})

module.exports = ratings = mongoose.model('ratings', ratingSchema);