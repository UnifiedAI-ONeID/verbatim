
import {
  connector,
} from 'firebase-dataconnect';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const db = getFirestore();
const storage = getStorage();
const auth = getAuth();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
        resolve(true);
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

export const createSession = connector.createSession(async (req) => {
    const { status } = req.params;
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to create a session.");
    }

    const sessionRef = db.collection(`users/${uid}/sessions`).doc();
    const newSession = {
        id: sessionRef.id,
        status,
        createdAt: new Date().toISOString(),
    };
    await sessionRef.set(newSession);
    return newSession;
});

export const updateSession = connector.updateSession(async (req) => {
    const { id: sessionId, ...sessionData } = req.params;
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to update a session.");
    }

    const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);
    await sessionRef.update(sessionData);
    const updatedSession = await sessionRef.get();
    return updatedSession.data();
});

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
        const session = await sessionRef.get();
        if (!session.exists) {
            throw new Error("Session not found.");
        }
        const deletedSession = session.data();
        await sessionRef.delete();
        await file.delete();
        return deletedSession;
    } catch (error) {
        console.error(`Error deleting session ${sessionId} for user ${uid}`, error);
        throw new Error("Unable to delete session.");
    }
});


export const generateSummary = connector.generateSummary(async (req) => {
    const { transcript } = req.params;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    const result = await model.generateContent(transcript);
    return result.response.text();
});

export const deleteAccount = connector.deleteAccount(async (req) => {
    const uid = req.auth?.uid;

    if (!uid) {
        throw new Error("User must be authenticated to delete an account.");
    }

    const userPath = `users/${uid}`;

    try {
        await deleteCollection(`${userPath}/sessions`, 50);
        await db.doc(userPath).delete();
        
        const bucket = storage.bucket();
        await bucket.deleteFiles({ prefix: `recordings/${uid}/` });

        await auth.deleteUser(uid);
        
        return true;

    } catch (error: any) {
        console.error("Error deleting account for user " + uid, error);
        throw new Error("An error occurred while deleting the account.");
    }
});
