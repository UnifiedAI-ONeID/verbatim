
import React, { useState, useEffect } from 'react';
import { doc, DocumentData, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import GenAIPrompt from './GenAIPrompt';
import '../style.css';

const SessionDetail = ({ sessionId, onBack }: { sessionId: string, onBack: () => void }) => {
    const [session, setSession] = useState<DocumentData | null>(null);

    useEffect(() => {
        const docRef = doc(db, "sessions", sessionId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setSession(doc.exists() ? { id: doc.id, ...doc.data() } : null);
        });
        return () => unsubscribe();
    }, [sessionId]);

    if (!session) {
        return <p>Loading session...</p>;
    }

    return (
        <div className="session-detail-container">
            <button onClick={onBack}>Back to Sessions</button>
            <h2>Session Details</h2>
            <p><strong>ID:</strong> {session.id}</p>
            <p><strong>Status:</strong> {session.status}</p>
            <GenAIPrompt sessionId={sessionId} />
        </div>
    );
};

export default SessionDetail;
