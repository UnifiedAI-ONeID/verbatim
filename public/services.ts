
// @google/genai Coding Guidelines: Fix Firebase v9 modular syntax errors by switching to v8 compat libraries.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";
import "firebase/compat/analytics";
import { GoogleGenAI } from "@google/genai";
import { firebaseConfig } from "./config.ts";

console.info('[Firebase] Initializing Firebase services...');
// --- Initialize Firebase with v8 compat syntax ---
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.info('[Firebase] Firebase app initialized.');
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const functions = firebase.functions();
export const analytics = firebase.analytics();

try {
    console.info('[Firestore] Attempting to enable offline persistence...');
    db.enablePersistence()
      .then(() => console.info('[Firestore] Offline persistence enabled.'))
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("[Firestore] Persistence failed: Multiple tabs open. Offline data will not be available.");
        } else if (err.code == 'unimplemented') {
          console.warn("[Firestore] Persistence not supported in this browser. The app will work online only.");
        }
      });
} catch (error) {
    console.error("[Firestore] An unexpected error occurred while enabling persistence:", error);
}

// Initialize Gemini. The API key is securely provided by the hosting environment.
console.info('[Gemini] Initializing GoogleGenAI client...');
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
console.info('[Gemini] GoogleGenAI client initialized.');
