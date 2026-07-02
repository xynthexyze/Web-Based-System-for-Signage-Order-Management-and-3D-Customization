import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2oVwhM8eI8kF8fl86_3AIWjCnlmTbSnU",
  authDomain: "vaernisignage.firebaseapp.com",
  projectId: "vaernisignage",
  storageBucket: "vaernisignage.appspot.com",
  messagingSenderId: "909456652985",
  appId: "1:909456652985:web:488fe8a87131ea5fa13968"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("Firebase initialized");
