const FCM = require("fcm-push");
const config = require('config');
const SendUserNotification = (title, body, priority, token) => {
    var fcm = new FCM(config.FCM_SERVER_KEY);
    var message = {
        to: token,
        priority: "high",
        notification: {
            title,
            body,
            priority,
            badge: 1,
            sound: 'default'
        },
        data: {
            type: "NOTIFICATION"
        }
    };
    fcm.send(message, function (err, response) {
        if (err) {
            console.log("Something has gone wrong!", err);
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });
};

module.exports = SendUserNotification;