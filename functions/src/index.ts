
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Get Gemini API Key from environment variables
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
    console.error("Gemini API key is not set.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey as string);

/**
 * Callable function to analyze audio from a session.
 */
export const analyzeAudio = onCall({ 
    timeoutSeconds: 540, 
    memory: '1GiB',
    secrets: ["GEMINI_API_KEY"],
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (!geminiApiKey) {
        throw new HttpsError("internal", "Server is not configured with a Gemini API key.");
    }

    const { sessionId, prompt } = request.data;
    const uid = request.auth.uid;

    if (!sessionId || !prompt) {
        throw new HttpsError("invalid-argument", "The function must be called with 'sessionId' and 'prompt' arguments.");
    }

    const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);

    try {
        await sessionRef.update({ status: 'analyzing' });

        const filePath = `recordings/${uid}/${sessionId}.webm`;
        const bucket = storage.bucket();
        const file = bucket.file(filePath);
        const [fileExists] = await file.exists();

        if (!fileExists) {
            await sessionRef.update({ status: 'error', error: 'Audio file not found.' });
            throw new HttpsError("not-found", "Audio file not found in Storage.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const audioBytes = (await file.download())[0].toString("base64");

        const audioPart = {
            inlineData: {
                mimeType: 'audio/webm',
                data: audioBytes,
            },
        };

        const result = await model.generateContent([prompt, audioPart]);
        const responseText = result.response.text();
        const responseJson = JSON.parse(responseText.replace(/```json\n|```/g, '').trim());

        await sessionRef.update({
            status: 'completed',
            results: responseJson,
            speakers: responseJson.speakers.reduce((acc: any, speaker: string) => ({...acc, [speaker]: speaker}), {})
        });

        return { success: true, message: "Analysis complete." };

    } catch (error: any) {
        console.error("Error during audio analysis for session " + sessionId, error);
        let errorMessage = "An unexpected error occurred during analysis.";
        if (error.message) {
            errorMessage = error.message;
        }
        await sessionRef.update({
            status: 'error',
            error: errorMessage
        });
        // Throwing an HttpsError to be caught by the client
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", errorMessage, error);
        }
    }
});

/**
 * Callable function to determine the next action based on context.
 */
export const takeAction = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
     if (!geminiApiKey) {
        throw new HttpsError("internal", "Server is not configured with a Gemini API key.");
    }

    const { prompt } = request.data;
    if (!prompt) {
        throw new HttpsError("invalid-argument", "The function must be called with a 'prompt' argument.");
    }
    
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
        });

        const result = await model.generateContent(prompt);
        const part = result.response.candidates?.[0]?.content?.parts?.[0];

        if (part && 'functionCall' in part) {
            const call = (part as { functionCall: { name: string; args: object } }).functionCall;
            return { type: call.name, args: call.args };
       } else {
            return { type: 'unknown' };
       }

    } catch (error: any) {
        console.error("Error in takeAction function:", error);
        throw new HttpsError("internal", "Failed to determine action.", error);
    }
});
