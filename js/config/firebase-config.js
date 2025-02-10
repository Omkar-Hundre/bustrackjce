// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBG1sp3K-nv_ROdBx_w_X7hysPIU1kromU",
    authDomain: "bus-track-2d362.firebaseapp.com",
    projectId: "bus-track-2d362",
    storageBucket: "bus-track-2d362.appspot.com",
    messagingSenderId: "84616304144",
    appId: "1:84616304144:web:6e2bff731979a1ed32dc95"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db }; 
