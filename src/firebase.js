import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1HZxH3hxFukNqaHb9QQWTRv6CFMKqc4E",
  authDomain: "dart-battle.firebaseapp.com",
  projectId: "dart-battle",
  storageBucket: "dart-battle.firebasestorage.app",
  messagingSenderId: "106476366699",
  appId: "1:106476366699:web:769f62a29908350a497a2e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);