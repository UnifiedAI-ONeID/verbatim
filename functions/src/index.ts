
import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  FunctionDeclarationSchema,
} from "@google/generative-ai";

initializeApp();

const generationConfig = {
  temperature: 0.3,
  topP: 1,
  topK: 32,
  maxOutputTokens: 8192,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export const analyzeAudio = onCall({
  timeoutSeconds: 540,
  secrets: ["GEMINI_API_KEY"],
}, async (request) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const audioModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig,
    safetySettings,
  });

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
  const sessionDocRef = firestore.doc(`users/${userId}/sessions/${sessionId}`);
  const filePath = `recordings/${userId}/${sessionId}.webm`;

  try {
    const file = storage.bucket().file(filePath);
    const [audioBytes] = await file.download();

    const audioPart = {
      inlineData: { mimeType: "audio/webm", data: audioBytes.toString("base64") },
    };
    const textPart = {
      text: "You are an expert multilingual meeting assistant. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, clearly list any financial figures mentioned. Identify all unique speakers. Format the output as a JSON object with keys: 'summary', 'actionItems' (an array of strings), 'transcript' (a string with newlines and speaker labels), and 'speakers' (an array of identified speaker labels like ['Speaker 1', 'Speaker 2']). Do not include the JSON markdown wrapper.",
    };

    const result = await audioModel.generateContent([textPart, audioPart]);
    const jsonString = result.response.text();
    const cleanedJsonString = jsonString.replace(/```json\n?|\n?```/g, "");
    const parsedResult = JSON.parse(cleanedJsonString);

    const results = {
      summary: parsedResult.summary || "No summary available.",
      actionItems: parsedResult.actionItems || [],
      transcript: parsedResult.transcript || "No transcript available.",
    };

    const speakers = (parsedResult.speakers || ["Speaker 1"]).reduce(
        (acc: any, speaker: any) => ({ ...acc, [speaker]: speaker }),
        {},
    );

    await sessionDocRef.update({
      results,
      speakers,
      status: "completed",
    });

    return { success: true, sessionId };
  } catch (error) {
    console.error("Error in analyzeAudio function:", error);
    await sessionDocRef.update({
      status: "error",
      error: "Failed to analyze audio.",
    });
    throw new Error("Error processing audio: " + error);
  }
});

export const determineAction = onCall({
  secrets: ["GEMINI_API_KEY"],
}, async (request) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const actionModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [
      {
        functionDeclarations: [
          {
            name: "create_calendar_event",
            description: "Creates a Google Calendar event.",
            parameters: {
              type: FunctionDeclarationSchema.Type.OBJECT,
              properties: {
                title: { type: FunctionDeclarationSchema.Type.STRING },
                description: { type: FunctionDeclarationSchema.Type.STRING },
                date: { type: FunctionDeclarationSchema.Type.STRING },
                time: { type: FunctionDeclarationSchema.Type.STRING },
              },
              required: ["title", "date", "time"],
            },
          },
          {
            name: "draft_email",
            description: "Drafts an email.",
            parameters: {
              type: FunctionDeclarationSchema.Type.OBJECT,
              properties: {
                to: { type: FunctionDeclarationSchema.Type.STRING },
                subject: { type: FunctionDeclarationSchema.Type.STRING },
                body: { type: FunctionDeclarationSchema.Type.STRING },
              },
              required: ["to", "subject", "body"],
            },
          },
          {
            name: "initiate_phone_call",
            description: "Initiates a phone call.",
            parameters: {
              type: FunctionDeclarationSchema.Type.OBJECT,
              properties: {
                phoneNumber: { type: FunctionDeclarationSchema.Type.STRING },
                reason: { type: FunctionDeclarationSchema.Type.STRING },
              },
              required: ["phoneNumber"],
            },
          },
          {
            name: "create_document",
            description: "Creates a text document.",
            parameters: {
              type: FunctionDeclarationSchema.Type.OBJECT,
              properties: {
                title: { type: FunctionDeclarationSchema.Type.STRING },
                content: { type: FunctionDeclarationSchema.Type.STRING },
              },
              required: ["title", "content"],
            },
          },
          {
            name: "draft_invoice_email",
            description: "Drafts an email to send an invoice.",
            parameters: {
              type: FunctionDeclarationSchema.Type.OBJECT,
              properties: {
                to: { type: FunctionDeclarationSchema.Type.STRING },
                recipientName: { type: FunctionDeclarationSchema.Type.STRING },
                subject: { type: FunctionDeclarationSchema.Type.STRING },
                amount: { type: FunctionDeclarationSchema.Type.NUMBER },
                currencySymbol: { type: FunctionDeclarationSchema.Type.STRING },
                itemDescription: { type: FunctionDeclarationSchema.Type.STRING },
              },
              required: [
                "to",
                "recipientName",
                "subject",
                "amount",
                "currencySymbol",
                "itemDescription",
              ],
            },
          },
        ],
      },
    ],
    generationConfig,
    safetySettings,
  });

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
      return { type: "no_action" };
    }
  } catch (error) {
    console.error("Error in determineAction function:", error);
    throw new Error("Error determining action: " + error);
  }
});
