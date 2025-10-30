
import {
  connector,
  createSession as createSessionResolver,
  updateSession as updateSessionResolver,
  deleteSession as deleteSessionResolver,
  generateSummary as generateSummaryResolver,
} from 'firebase-dataconnect';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin services
const db = getFirestore();
const storage = getStorage();
const auth = getAuth();

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Helper function to recursively delete a collection and its subcollections.
 */
async function deleteCollection(collectionPath: string, batchSize: number) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: (value: unknown) => void) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        // When there are no documents left, we are done
        resolve(true);
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid hitting stack limits
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

/**
 * Creates a new session.
 */
export const createSession = connector.createSession(createSessionResolver);

/**
 * Updates an existing session.
 */
export const updateSession = connector.updateSession(updateSessionResolver);

/**
 * Deletes an existing session and its associated recording.
 */
export const deleteSession = connector.deleteSession(async (req) => {
    const { id: sessionId } = req.params;
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to delete a session.");
    }

    const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);
    const filePath = `recordings/${uid}/${sessionId}.webm`;
    const file = storage.bucket().file(filePath);

    try {
        await sessionRef.delete();
        await file.delete();
        return { success: true, message: "Session and recording deleted successfully." };
    } catch (error) {
        console.error(`Error deleting session ${sessionId} for user ${uid}`, error);
        throw new Error("Unable to delete session.");
    }
});


/**
 * Analyzes a session's audio recording to generate a summary and identify speakers.
 */
export const generateSummary = connector.generateSummary(async (req) => {
    const { sessionId, prompt } = req.params;
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to analyze audio.");
    }
     if (!sessionId || !prompt) {
        throw new Error("The function must be called with 'sessionId' and 'prompt' arguments.");
    }

    const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);

    try {
        await sessionRef.update({ status: 'analyzing' });

        const filePath = `recordings/${uid}/${sessionId}.webm`;
        const file = storage.bucket().file(filePath);
        const [fileExists] = await file.exists();

        if (!fileExists) {
            await sessionRef.update({ status: 'error', error: 'Audio file not found.' });
            throw new Error("Audio file not found in Storage.");
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
        
        // Return a summary string
        return "Analysis complete.";

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
        throw new Error(errorMessage);
    }
});

/**
 * Deletes a user's account and all their data.
 */
export const deleteAccount = connector.deleteAccount(async (req) => {
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to delete an account.");
    }

    const userPath = `users/${uid}`;

    try {
        // Recursively delete all documents and subcollections under the user's document
        await deleteCollection(`${userPath}/sessions`, 50);
        await db.doc(userPath).delete();
        
        // Delete all of the user's recordings from Storage
        const bucket = storage.bucket();
        await bucket.deleteFiles({ prefix: `recordings/${uid}/` });

        // Finally, delete the user from Firebase Authentication
        await auth.deleteUser(uid);
        
        return true;

    } catch (error: any) {
        console.error("Error deleting account for user " + uid, error);
        throw new Error("An error occurred while deleting the account.");
    }
});
