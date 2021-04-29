
const config = require('config')

exports.sendAlertSms = async (driver, reason) => {

    const Setting = require('../models/settings')
    let settings = await Setting.findOne({}, {
        office_mobile: 1
    })
    var api = require('./api.js');
    
    var smsApi = new api.SMSApi(config.CLICKSEND_USERNAME, config.CLICKSEND_APIKEY);
    
    var smsMessage = new api.SmsMessage();
    
    smsMessage.source = "sdk";
    smsMessage.from = "RICENGRILLS"
    // smsMessage.to = `+61${config.ADMIN_MOBILE}`;
    smsMessage.to = `+61${settings.office_mobile}`;
    smsMessage.body = `Alert from driver ${driver.name}. Reason: ${reason}`;
    
    var smsCollection = new api.SmsMessageCollection();
    
    smsCollection.messages = [smsMessage];
    
    smsApi.smsSendPost(smsCollection).then(function(response) {
      console.log(response.body);
    }).catch(function(err){
      console.error(err.body);
    });
}
