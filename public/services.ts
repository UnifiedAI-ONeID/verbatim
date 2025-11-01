import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";
import { GoogleGenAI } from "@google/genai";
import { firebaseConfig } from "./config";

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
export const analytics = getAnalytics(firebaseApp);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence not supported in this browser.");
    }
  });
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Initialize Gemini
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

console.log("Firebase and Gemini services initialized.");
