import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD2q8piBhZ0i9z7BngaHv2DwIeIvdiUP9I",
    authDomain: "audioanalyzer-e8354.firebaseapp.com",
    projectId: "audioanalyzer-e8354",
    storageBucket: "audioanalyzer-e8354.firebasestorage.app",
    messagingSenderId: "1038893244188",
    appId: "1:1038893244188:web:eb86301d68fac3d10a24d9",
    measurementId: "G-Y3S920DKCT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);