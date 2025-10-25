const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenAI } = require("@google/genai");

initializeApp();

// Set GEMINI_API_KEY in your Cloud Functions environment
// Run: firebase functions:config:set gemini.key="YOUR_API_KEY"
const geminiApiKey = functions.config().gemini.key;
const ai = new GoogleGenAI({apiKey: geminiApiKey});

exports.analyzeAudio = functions.runWith({timeoutSeconds: 540}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const userId = context.auth.uid;
  const { sessionId } = data;

  if (!sessionId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Session ID is required."
    );
  }

  const firestore = getFirestore();
  const storage = getStorage();
  const sessionDocRef = firestore.doc(`users/${userId}/sessions/${sessionId}`);
  const filePath = `recordings/${userId}/${sessionId}.webm`;

  try {
    const file = storage.bucket().file(filePath);
    const [audioBytes] = await file.download();
    const base64Audio = audioBytes.toString("base64");

    const audioPart = { inlineData: { mimeType: "audio/webm", data: base64Audio } };
    const textPart = { text: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, pay special attention to and clearly list any financial figures, budgets, or costs mentioned. Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.' };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [audioPart, textPart] }],
    });
    
    let jsonString = response.text;
    
    // Clean the response from markdown code fences if they exist
    if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith('```')) {
         jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }

    const parsedResult = JSON.parse(jsonString);

    const results = {
      summary: parsedResult.summary || "No summary generated.",
      actionItems: parsedResult.actionItems || [],
      transcript: parsedResult.transcript || "No transcript generated.",
    };
    
    // Convert speaker array to the map format the frontend expects
    const speakers = (parsedResult.speakers || ["Speaker 1"]).reduce(
        (acc, speaker) => ({...acc, [speaker]: speaker}), {}
    );

    await sessionDocRef.update({
      results,
      speakers,
      status: "completed",
    });

    return { success: true, sessionId };
  } catch (error) {
    console.error(`Error in analyzeAudio for session ${sessionId}, user ${userId}:`, error);
    await sessionDocRef.update({
      status: "error",
      error: "Failed to analyze audio on the server.",
    });
    
    throw new functions.https.HttpsError(
      "internal",
      "Error processing audio.",
      error.message
    );
  }
});
