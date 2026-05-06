// js/firebase.js (Compat Version)
// firebaseConfig is loaded from js/config.js (gitignored — never committed)
// For setup, copy js/config.example.js → js/config.js and fill in your keys.

// Initialize Firebase using config provided by js/config.js
if (typeof firebaseConfig === "undefined") {
    console.error(
        "❌ Firebase config not found! " +
        "Please copy js/config.example.js to js/config.js and fill in your credentials."
    );
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app(); // if already initialized, use that one
    }
    console.log("Firebase Initialized Successfully");
}