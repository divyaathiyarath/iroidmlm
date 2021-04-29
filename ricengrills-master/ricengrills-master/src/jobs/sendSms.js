var Queue = require('bull');
const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId
const User = mongoose.model('users')
const config = require('config')
const FCM = require('fcm-push');
const { sendSms } = require("../utils/sendsms")
let fcm = new FCM(config.fcm);

var sendUserSignInSms = new Queue('send sigin in otp', {redis: { port: 6379, host: '127.0.0.1'} });

sendUserSignInSms.process(async function (job, done) {
    let { user_id } = job.data
    let user = await User.findOne({ _id: ObjectId(user_id) })
    if (user) {
        await sendSms(user.mobile, user.otp)
        console.log('sms send' + user.otp)
        job.progress(1)
    }
    done();
});

module.exports = {
    sendUserSignInSms
}