importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-messaging.js');
alert()
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
messaging = firebase.messaging();
messaging.usePublicVapidKey("BLO7tyt_Oyb4bOW32CWxEAXbx3J383VKs8Iz7WAlqbCrW26lxUsswpavK8FEnV9XN6EJgczbRmG7mJ-C-uhTCVk");
messaging.getToken().then((currentToken) => {
    
    if (currentToken) {
        console.log({ currentToken })
        sendTokenToServer(currentToken);
        updateUIForPushEnabled(currentToken);
    } else {
        // Show permission request.
        console.log('No registration token available. Request permission to generate one.');
        // Show permission UI.
        updateUIForPushPermissionRequired();
        setTokenSentToServer(false);
    }
}).catch((err) => {
    console.log('An error occurred while retrieving token. ', err);
    showToken('Error retrieving registration token. ', err);
    setTokenSentToServer(false);
});