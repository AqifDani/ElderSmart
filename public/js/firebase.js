// js/firebase.js
// firebaseConfig is loaded from js/config.js (gitignored — never committed)
// For setup, copy js/config.example.js → js/config.js and fill in your keys.

if (typeof firebaseConfig === "undefined") {
    console.error(
        "❌ Firebase config not found! " +
        "Please copy js/config.example.js to js/config.js and fill in your credentials."
    );
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }
    console.log("Firebase Initialized Successfully");
}