
import { GoogleGenerativeAI } from '@google/genai';
import { firebaseadmin } from '@dataconnect/firebase-admin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const Mutation = {
    async generateSummary(root, { transcript }) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const prompt = `Summarize the following meeting transcript in a concise, bulleted list:

${transcript}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;

            if (response.promptFeedback?.blockReason) {
                throw new Error(`Request was blocked due to ${response.promptFeedback.blockReason}`);
            }

            const text = response.text();
            return text;
        } catch (error) {
            console.error('Error generating summary:', error);
            throw new Error('Failed to generate summary.');
        }
    },

    async createSession(root, { status }) {
        const db = firebaseadmin.firestore();
        const newSession = {
            createdAt: new Date(),
            status,
            uploadProgress: 0,
            audioUrl: '',
            transcription: '',
            summary: '',
        };
        const docRef = await db.collection('sessions').add(newSession);
        return {
            id: docRef.id,
            ...newSession,
        };
    },

    async updateSession(root, args) {
        const db = firebaseadmin.firestore();
        const { id, ...data } = args;
        await db.collection('sessions').doc(id).update(data);
        const updatedDoc = await db.collection('sessions').doc(id).get();
        return {
            id: updatedDoc.id,
            ...updatedDoc.data(),
        };
    },

    async deleteSession(root, { id }) {
        const db = firebaseadmin.firestore();
        const doc = await db.collection('sessions').doc(id).get();
        if (!doc.exists) {
            throw new Error('Session not found');
        }
        await db.collection('sessions').doc(id).delete();
        return {
            id: doc.id,
            ...doc.data(),
        };
    }
};
