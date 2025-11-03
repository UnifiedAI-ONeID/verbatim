

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/functions';
import 'firebase/compat/analytics';
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { firebaseConfig } from "./config.ts";

// Fix: Initialize Firebase with the v8 compat SDK to resolve module errors.
const app = firebase.initializeApp(firebaseConfig);

export const analytics = firebase.analytics();
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const functions = firebase.functions();

// Fix: Use the v8 compat version of enablePersistence.
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence not supported in this browser.");
    }
  });

// Initialize Gemini. The API key is securely provided by the hosting environment.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });