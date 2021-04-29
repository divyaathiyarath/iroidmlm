self.importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-app.js');
self.importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-messaging.js');
var firebaseConfig = {
    apiKey: "AIzaSyA2fLz-V4fg0kFTpZwVzhydlgg7Z4lyVxU",
    authDomain: "risengrills.firebaseapp.com",
    databaseURL: "https://risengrills.firebaseio.com",
    projectId: "risengrills",
    storageBucket: "risengrills.appspot.com",
    messagingSenderId: "438493239080",
    appId: "1:438493239080:web:1794421360a26a7eae221d",
    measurementId: "G-5VQ97JP8J4"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(function (payload) {
    
    var { notification: {
        title,
        body,
        image
    } } = payload

    const notificationTitle = title;
    const notificationOptions = {
        body: body,
        icon: image
    };

    self.registration.showNotification(notificationTitle,
        notificationOptions);
});

function sendTokenToServer(currentToken) {
    fetch("/update_device_token", {
        method: 'post',
        headers: {
            "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: `token=${currentToken}`
    })
        .then(function (data) {
            console.log('Request succeeded with JSON response', data);
        })
        .catch(function (error) {
            console.log('Request failed', error);
        });
}

function updateUIForPushEnabled(currentToken) {
    console.log({ currentToken })
}

function showToken(message) {
    console.log(message)
}

messaging.getToken({ vapidKey: 'BLO7tyt_Oyb4bOW32CWxEAXbx3J383VKs8Iz7WAlqbCrW26lxUsswpavK8FEnV9XN6EJgczbRmG7mJ-C-uhTCVk' }).then((currentToken) => {
    if (currentToken) {
        sendTokenToServer(currentToken);
        updateUIForPushEnabled(currentToken);
    } else {
        console.log('No registration token available. Request permission to generate one.');
        updateUIForPushPermissionRequired();
        sendTokenToServer(null);
    }
}).catch((err) => {
    console.log('An error occurred while retrieving token. ', err);
    showToken('Error retrieving registration token. ', err);
    sendTokenToServer(null);
});