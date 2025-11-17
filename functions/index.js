
const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenAI } = require("@google/genai");

// Initialize Firebase Admin SDK
try {
    initializeApp();
    functions.logger.info("Firebase Admin SDK initialized successfully.");
} catch (error) {
    functions.logger.error("Error initializing Firebase Admin SDK:", error);
}

// Set GEMINI_API_KEY in your Cloud Functions environment using Firebase's secret management.
// Run: firebase functions:config:set gemini.key="YOUR_API_KEY"
const geminiApiKey = functions.config().gemini.key;
if (!geminiApiKey) {
    functions.logger.error("FATAL: GEMINI_API_KEY not set in Function configuration. Function will not work.");
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });
functions.logger.info("GoogleGenAI client initialized.");

exports.analyzeAudio = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        functions.logger.warn("Function called by unauthenticated user.");
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }
    const userId = context.auth.uid;

    // 2. Input Validation
    const { sessionId, prompt } = data;
    if (!sessionId) {
        functions.logger.warn(`Invalid argument: Session ID is missing for user ${userId}.`);
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Session ID is a required argument."
        );
    }
    functions.logger.info(`[${sessionId}] Function triggered for user: ${userId}.`);

    // 3. Firestore and Storage Setup
    const firestore = getFirestore();
    const storage = getStorage();
    const sessionDocRef = firestore.doc(`users/${userId}/sessions/${sessionId}`);
    const filePath = `recordings/${userId}/${sessionId}.webm`;
    const file = storage.bucket().file(filePath);

    try {
        // 4. Download Audio File from Cloud Storage
        functions.logger.info(`[${sessionId}] Downloading audio file: ${filePath}`);
        const [audioBytes] = await file.download();
        functions.logger.info(`[${sessionId}] Audio file downloaded. Size: ${Math.round(audioBytes.length / 1024)} KB.`);

        // 5. Prepare Payload for Gemini API
        const base64Audio = audioBytes.toString("base64");
        const audioPart = { inlineData: { mimeType: "audio/webm", data: base64Audio } };
        const textPart = { text: prompt };

        // 6. Call Gemini API for analysis
        functions.logger.info(`[${sessionId}] Calling Gemini API (gemini-2.5-flash) for analysis...`);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [audioPart, textPart] }],
            config: {
                responseMimeType: 'application/json'
            }
        });
        functions.logger.info(`[${sessionId}] Received response from Gemini API.`);

        // 7. Parse Gemini's JSON Response
        let jsonString = response.text;
        functions.logger.debug(`[${sessionId}] Raw Gemini response text: ${jsonString}`);

        // Clean the response from markdown code fences if they exist
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring(7, jsonString.length - 3).trim();
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.substring(3, jsonString.length - 3).trim();
        }
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(jsonString);
            functions.logger.info(`[${sessionId}] Successfully parsed Gemini JSON response.`);
        } catch(parseError) {
            functions.logger.error(`[${sessionId}] Failed to parse JSON response from Gemini. String was: ${jsonString}`, parseError);
            throw new functions.https.HttpsError("internal", "Failed to parse AI response.", parseError.message);
        }

        // 8. Structure and Sanitize the Final Results
        const results = {
            summary: parsedResult.summary || "No summary generated.",
            actionItems: parsedResult.actionItems || [],
            transcript: parsedResult.transcript || "No transcript generated.",
        };
        
        const speakers = (parsedResult.speakers || ["Speaker 1"]).reduce(
            (acc, speaker) => ({...acc, [speaker]: speaker}), {}
        );

        // 9. Update Firestore with Results
        functions.logger.info(`[${sessionId}] Updating Firestore document with results.`);
        await sessionDocRef.update({
            results,
            speakers,
            status: "completed",
        });
        functions.logger.info(`[${sessionId}] Firestore updated. Function execution successful.`);

        return { success: true, sessionId };

    } catch (error) {
        // 10. Robust Error Handling
        const errorMessage = error.message || "An unexpected error occurred.";
        functions.logger.error(`[${sessionId}] Error in analyzeAudio for user ${userId}:`, error);

        // Update Firestore to reflect the error state
        await sessionDocRef.update({
            status: "error",
            error: "Failed to analyze audio on the server. " + errorMessage,
        });
        
        // Re-throw HttpsError to be caught by the client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        throw new functions.https.HttpsError(
            "internal",
            "An internal server error occurred during analysis.",
            errorMessage
        );
    }
});
