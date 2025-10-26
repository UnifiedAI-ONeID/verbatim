
const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { defineString } = require("firebase-functions/params");

initializeApp();

// Define the Gemini API Key from a secret parameter for security
const geminiApiKey = defineString("GEMINI_API_KEY");

// Initialize the Gemini client with the API key
const genAI = new GoogleGenerativeAI(geminiApiKey.value());

// Common configuration for the generative model to ensure consistency
const generationConfig = {
  temperature: 0.3,
  topP: 1,
  topK: 32,
  maxOutputTokens: 8192,
};

// Safety settings to prevent blocking legitimate content
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Reusable generative model instance for analyzing audio content
const audioModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig,
  safetySettings
});

// Reusable generative model instance for determining actions using function calling
const actionModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  tools: [
    {
      functionDeclarations: [
        { name: 'create_calendar_event', description: 'Creates a Google Calendar event.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' } }, required: ['title', 'date', 'time'] } },
        { name: 'draft_email', description: 'Drafts an email.', parameters: { type: 'OBJECT', properties: { to: { type: 'STRING' }, subject: { type: 'STRING' }, body: { type: 'STRING' } }, required: ['to', 'subject', 'body'] } },
        { name: 'initiate_phone_call', description: 'Initiates a phone call.', parameters: { type: 'OBJECT', properties: { phoneNumber: { type: 'STRING' }, reason: { type: 'STRING' } }, required: ['phoneNumber'] } },
        { name: 'create_document', description: 'Creates a text document.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['title', 'content'] } },
        { name: 'draft_invoice_email', description: 'Drafts an email to send an invoice.', parameters: { type: 'OBJECT', properties: { to: { type: 'STRING' }, recipientName: { type: 'STRING' }, subject: { type: 'STRING' }, amount: { type: 'NUMBER' }, currencySymbol: { type: 'STRING' }, itemDescription: { type: 'STRING' } }, required: ['to', 'recipientName', 'subject', 'amount', 'currencySymbol', 'itemDescription'] } },
      ],
    },
  ],
  generationConfig,
  safetySettings
});

/**
 * Analyzes an audio file from Cloud Storage, generates a summary, action items,
 * and a transcript, and updates the session in Firestore.
 */
exports.analyzeAudio = onCall({ timeoutSeconds: 540, secrets: ["GEMINI_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new Error("The function must be called while authenticated.");
  }

  const { sessionId } = request.data;
  const userId = request.auth.uid;

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const firestore = getFirestore();
  const storage = getStorage();
  const sessionDocRef = firestore.doc('users/' + userId + '/sessions/' + sessionId);
  const filePath = 'recordings/' + userId + '/' + sessionId + '.webm';

  try {
    const file = storage.bucket().file(filePath);
    const [audioBytes] = await file.download();
    
    const audioPart = { inlineData: { mimeType: "audio/webm", data: audioBytes.toString("base64") } };
    const textPart = { text: "You are an expert multilingual meeting assistant. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, clearly list any financial figures mentioned. Identify all unique speakers. Format the output as a JSON object with keys: 'summary', 'actionItems' (an array of strings), 'transcript' (a string with newlines and speaker labels), and 'speakers' (an array of identified speaker labels like ['Speaker 1', 'Speaker 2']). Do not include the JSON markdown wrapper." };

    const result = await audioModel.generateContent([textPart, audioPart]);
    const jsonString = result.response.text();
    const cleanedJsonString = jsonString.replace(/```json\n?|\n?```/g, '');
    const parsedResult = JSON.parse(cleanedJsonString);

    const results = {
      summary: parsedResult.summary || "No summary available.",
      actionItems: parsedResult.actionItems || [],
      transcript: parsedResult.transcript || "No transcript available.",
    };

    const speakers = (parsedResult.speakers || ["Speaker 1"]).reduce(
        (acc, speaker) => ({...acc, [speaker]: speaker }), {}
    );

    await sessionDocRef.update({
      results,
      speakers,
      status: "completed",
    });

    return { success: true, sessionId };
  } catch (error) {
    console.error("Error in analyzeAudio function:", error);
    await sessionDocRef.update({ status: "error", error: "Failed to analyze audio." });
    throw new Error("Error processing audio: " + error.message);
  }
});

/**
 * Determines the appropriate action to take based on a user's prompt and meeting context.
 * Uses Gemini's function calling feature to select a tool.
 */
exports.determineAction = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new Error("The function must be called while authenticated.");
  }
  
  const { prompt } = request.data;
  if (!prompt) {
    throw new Error("A prompt is required.");
  }

  try {
    const result = await actionModel.generateContent(prompt);
    const call = result.response.functionCalls()?.[0];

    if (call) {
      return { type: call.name, args: call.args };
    } else {
      return { type: 'no_action' };
    }
  } catch(error) {
    console.error("Error in determineAction function:", error);
    throw new Error("Error determining action: " + error.message);
  }
});
