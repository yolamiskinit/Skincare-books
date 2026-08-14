import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, getDocsFromCache, getDocsFromServer,
  setDoc, deleteDoc, writeBatch, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLkqJH75Ve3xpr1xxGpkPKMD4pUmg21XA",
  authDomain: "skincarebooks-eb8a8.firebaseapp.com",
  projectId: "skincarebooks-eb8a8",
  storageBucket: "skincarebooks-eb8a8.firebasestorage.app",
  messagingSenderId: "269469868004",
  appId: "1:269469868004:web:ac2c9efac7d1a302d5b1f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
enableIndexedDbPersistence(firestore).catch(() => { /* multiple tabs open, or unsupported browser: ignore */ });

window.FB = {
  auth,
  firestore,
  collection, doc, getDoc, getDocs, getDocsFromCache, getDocsFromServer, setDoc, deleteDoc, writeBatch,
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
  signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  signOutUser: () => signOut(auth)
};
window.dispatchEvent(new Event('firebase-ready'));
