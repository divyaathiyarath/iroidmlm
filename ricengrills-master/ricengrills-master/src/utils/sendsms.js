// const SendOtp = require('sendotp');
// const sendOtp = new SendOtp('8761AbElRfhjXlOj5f97b3fcP123');
// const config = require('config')

// exports.sendSms = async (phone, otp) => {
//     await sendOtp.send(`61${phone}`, config.MSG_SENDERID, otp, function (error, data) {
//         console.log(data);
//     });
//     return true
// }

const config = require('config')

exports.sendSms = async (phone, otp) => {
    var api = require('./api.js');
    
    var smsApi = new api.SMSApi(config.CLICKSEND_USERNAME, config.CLICKSEND_APIKEY);
    
    var smsMessage = new api.SmsMessage();
    
    smsMessage.source = "sdk";
    smsMessage.from = "RICENGRILLS"
    smsMessage.to = `+61${phone}`;
    smsMessage.body = `${otp} is your OTP. Do not share this code with anyone else`;
    
    var smsCollection = new api.SmsMessageCollection();
    
    smsCollection.messages = [smsMessage];
    
    smsApi.smsSendPost(smsCollection).then(function(response) {
      console.log(response.body);
    }).catch(function(err){
      console.error(err.body);
    });
}
