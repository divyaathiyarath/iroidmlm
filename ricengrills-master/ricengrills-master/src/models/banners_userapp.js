const mongoose = require('mongoose')
const Schema = mongoose.Schema
const bannerSchema = new Schema({
    image: {
        type: String,
        required:true
    },
    created_at:{
        type: Schema.Types.Date,
        default: Date.now()
    },
    deleted_at:{
        type: Schema.Types.Date
    },
    delete_status:{
        type:Boolean,
        default:false
    }
});
module.exports = banners_userapp = mongoose.model('banners_userapp', bannerSchema);