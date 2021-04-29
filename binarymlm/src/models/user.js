const mongoose = require('mongoose')
const userSchema = new mongoose.Schema({
    name:{
        type:String
    },
    email:{
        type:String
    },
    phone:{
        type:Number
    },
    referenceId:{
        type: String
    },
    userCode:{
        type:String
    },
    referencePoint:{
        type:Number,
        default:0
    },
    matchingPoint:{
        type:Number,
        default:0
    },
    parent:{
        type: String
    },
    lc:{
        type: String,
        default:null
    },
    rc:{
        type: String,
        default:null
    },
    rootParent: {
        type: String
    }
})
module.exports = mongoose.model('user',userSchema)