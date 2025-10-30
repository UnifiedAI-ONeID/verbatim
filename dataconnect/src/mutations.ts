
import { GoogleGenerativeAI } from '@google/genai';
import { firebaseadmin } from '@dataconnect/firebase-admin';

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

export const Mutation = {
    async generateSummary(root, { transcript }) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const prompt = `Summarize the following meeting transcript:

${transcript}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text;
        } catch (error) {
            console.error('Error generating summary:', error);
            throw new Error('Failed to generate summary.');
        }
    },
};
