const mongoose = require('mongoose')
const Schema = mongoose.Schema
const privacyPolicySchema = new Schema({
    title: {
        type: String
    },
    description: {
        type: String
    }
});

module.exports = privacy_policies = mongoose.model('privacy_policies', privacyPolicySchema);