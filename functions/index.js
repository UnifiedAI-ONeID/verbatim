
const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenerativeAI, FunctionDeclaration, HarmCategory, HarmBlockThreshold, Type } = require("@google/generative-ai");

initializeApp();

// Initialize the Gemini AI part with the API key from the environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const defaultAnalysisPrompt = 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, pay special attention to and clearly list any financial figures, budgets, or costs mentioned. Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.';

exports.analyzeAudio = functions.runWith({
  timeoutSeconds: 540,
  memory: '1GB',
  secrets: ["GEMINI_API_KEY"]
}).https.onCall(async (data, context) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new functions.https.HttpsError(
      "internal",
      "GEMINI_API_KEY is not set up on the server."
    );
  }
  
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const userId = context.auth.uid;
  const { sessionId, prompt } = data;

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

    const [metadata] = await file.getMetadata();
    if (metadata.contentType !== "audio/webm") {
        await sessionDocRef.update({
          status: "error",
          error: "Invalid file type. Only 'audio/webm' is accepted.",
        });
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid file type."
        );
    }
      
    const [audioBytes] = await file.download();
    const base64Audio = audioBytes.toString("base64");

    const audioPart = { inlineData: { mimeType: "audio/webm", data: base64Audio } };
    const textPart = { text: prompt || defaultAnalysisPrompt };

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([textPart, audioPart]);
    const response = await result.response;
    let jsonString = response.text();

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

const tools = [
    { name: 'create_calendar_event', description: 'Creates a Google Calendar event.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The title of the event.' }, description: { type: Type.STRING, description: 'The description or agenda for the event.' }, date: { type: Type.STRING, description: 'The date of the event in YYYY-MM-DD format.' }, time: { type: Type.STRING, description: 'The time of the event in HH:MM format (24-hour).' } }, required: ['title', 'date', 'time'] } },
    { name: 'draft_email', description: 'Drafts an email to a recipient.', parameters: { type: Type.OBJECT, properties: { to: { type: Type.STRING, description: 'The recipient\'s email address.' }, subject: { type: Type.STRING, description: 'The subject line of the email.' }, body: { type: Type.STRING, description: 'The body content of the email.' } }, required: ['to', 'subject', 'body'] } },
    { name: 'draft_invoice_email', description: 'Drafts an email with an invoice for a client.', parameters: { type: Type.OBJECT, properties: { recipient_name: { type: Type.STRING, description: 'The name of the person or company receiving the invoice.' }, item_description: { type: Type.STRING, description: 'A description of the product or service being invoiced.' }, amount: { type: Type.NUMBER, description: 'The total amount due.' } }, required: ['recipient_name', 'item_description', 'amount'] } },
    { name: 'initiate_phone_call', description: 'Initiates a phone call.', parameters: { type: Type.OBJECT, properties: { phone_number: { type: Type.STRING, description: 'The phone number to call.' }, reason: { type: Type.STRING, description: 'A brief summary of why the call is being made.' } }, required: ['phone_number'] } },
    { name: 'create_google_doc', description: 'Creates a new Google Document with specified content.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The title of the document.' }, content: { type: Type.STRING, description: 'The initial content to be placed in the document.' } }, required: ['title', 'content'] } }
];

exports.takeAction = functions.runWith({
    secrets: ["GEMINI_API_KEY"]
}).https.onCall(async (data, context) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new functions.https.HttpsError(
      "internal",
      "GEMINI_API_KEY is not set up on the server."
    );
  }
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { prompt } = data;
  if (!prompt) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A prompt is required."
    );
  }

  try {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: [{ functionDeclarations: tools }],
    });
    const result = await model.generateContent(prompt);
    const call = result.response.functionCalls()?.[0];

    if (call) {
      return { type: call.name, args: call.args };
    } else {
      return { type: 'unknown' };
    }
  } catch (error) {
    console.error("Error in takeAction function:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error processing your request.",
      error.message
    );
  }
});
