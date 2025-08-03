// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASIN01StEyruTUpiHlBfiF1zNfGXwxLgY",
  authDomain: "chapterkeeper-786b3.firebaseapp.com",
  projectId: "chapterkeeper-786b3",
  storageBucket: "chapterkeeper-786b3.firebasestorage.app",
  messagingSenderId: "37697630073",
  appId: "1:37697630073:web:42be28e6bdd42f705849a8",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
