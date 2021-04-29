const mongoose = require('mongoose')
const Schema = mongoose.Schema
const termsAndConditionSchema = new Schema({
    title: {
        type: String
    },
    description: {
        type: String
    }
});

module.exports = terms_conditions = mongoose.model('terms_conditions', termsAndConditionSchema);