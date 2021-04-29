const mongoose = require('mongoose')
const Schema = mongoose.Schema
const bannerSchema = new Schema({
    image: {
        type: String,
        required:true
    },
    type:{
        type: String,
        enum: ['HOME','USERAPP'],
        default:"HOME"
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
module.exports = banners = mongoose.model('banners', bannerSchema);