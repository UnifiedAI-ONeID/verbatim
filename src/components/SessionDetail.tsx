
import React from 'react';
import { useSession } from '../hooks/useSession';
import GenAIPrompt from './GenAIPrompt';
import '../style.css';

const SessionDetail = ({ sessionId, onBack }: { sessionId: string, onBack: () => void }) => {
    const { data, isLoading, error } = useSession({ id: sessionId });

    if (isLoading) return <div className="loading-indicator"></div>;
    if (error) return <p>Error loading session: {error.message}</p>;
    if (!data) return <p>Session not found.</p>;

    const session = data.todo;

    return (
        <div className="session-detail-container">
            <button onClick={onBack} className="secondary-button" style={{ marginBottom: '1rem' }}>Back to Sessions</button>
            <header>
                <h2>Session Details</h2>
                <p><strong>ID:</strong> {session.id}</p>
                <p><strong>Title:</strong> {session.title}</p>
                <p><strong>Completed:</strong> {session.completed ? 'Yes' : 'No'}</p>
            </header>

            <GenAIPrompt session={session} />
        </div>
    );
};

export default SessionDetail;
