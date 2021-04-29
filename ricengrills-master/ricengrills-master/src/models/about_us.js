const mongoose = require('mongoose')
const Schema = mongoose.Schema
const aboutUsSchema = new Schema({
    title: {
        type: String
    },
    description: {
        type: String
    }
});

module.exports = about_us = mongoose.model('about_us', aboutUsSchema);