

// @google/genai Coding Guidelines: Fix Firebase v9 modular syntax errors by switching to v8 compat libraries.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";
import "firebase/compat/analytics";
import { GoogleGenAI } from "@google/genai";
import { firebaseConfig } from "./config.ts";

// --- Initialize Firebase with v8 compat syntax ---
const app = firebase.initializeApp(firebaseConfig);

export const analytics = firebase.analytics();
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const functions = firebase.functions();

try {
    db.enablePersistence()
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore persistence failed: multiple tabs open.");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore persistence not supported in this browser.");
        }
      });
} catch (error) {
    console.error("Error enabling Firestore persistence:", error);
}

// Initialize Gemini. The API key is securely provided by the hosting environment.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });