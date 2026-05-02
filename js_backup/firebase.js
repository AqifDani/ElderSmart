// js/firebase.js (Compat Version)

const firebaseConfig = {
  apiKey: "AIzaSyD_6R_a0HPxKNkF2iBsRK926IGqheXyzJI",
  authDomain: "eldersmart-a0be1.firebaseapp.com",
  databaseURL: "https://eldersmart-a0be1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eldersmart-a0be1",
  storageBucket: "eldersmart-a0be1.firebasestorage.app",
  messagingSenderId: "398876548908",
  appId: "1:398876548908:web:a42a0f7202cc87eb735689",
  measurementId: "G-N7W0LXQCSN"
};

// Initialize Firebase (Standard Way)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

// Optional: Enable offline persistence for Firestore if you want
// firebase.firestore().enablePersistence().catch(err => console.log(err));

console.log("Firebase Initialized Successfully");