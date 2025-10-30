
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const generateSummary = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { transcript } = request.data;
  if (!transcript) {
    throw new HttpsError("invalid-argument", "Transcript is required.");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Summarize the following transcript:\n\n${transcript}`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating summary:", error);
    throw new HttpsError("internal", "Failed to generate summary.");
  }
});

export const deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  try {
    // Delete user from Auth
    await getAuth().deleteUser(uid);

    // Delete user data from Firestore
    const firestore = getFirestore();
    const collections = ["sessions"];

    for (const collection of collections) {
      const querySnapshot = await firestore.collection(collection).where("userId", "==", uid).get();
      const batch = firestore.batch();
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    return { message: "Account deleted successfully." };
  } catch (error) {
    console.error("Error deleting account:", error);
    throw new HttpsError("internal", "Failed to delete account.");
  }
});
