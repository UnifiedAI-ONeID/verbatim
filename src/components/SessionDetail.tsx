
import React from 'react';
import { useQuery, gql } from '@apollo/client';
import GenAIPrompt from './GenAIPrompt';
import '../style.css';

const GET_SESSION = gql`
    query GetSession($sessionId: ID!) {
        session(id: $sessionId) {
            id
            createdAt
            status
            transcription
            audioUrl
        }
    }
`;

const SessionDetail = ({ sessionId, onBack }: { sessionId: string, onBack: () => void }) => {
    const { data, loading, error } = useQuery(GET_SESSION, {
        variables: { sessionId },
    });

    if (loading) return <div className="loading-indicator"></div>;
    if (error) return <p>Error loading session: {error.message}</p>;
    if (!data || !data.session) return <p>Session not found.</p>;

    const { session } = data;

    return (
        <div className="session-detail-container">
            <button onClick={onBack} className="secondary-button" style={{ marginBottom: '1rem' }}>Back to Sessions</button>
            <header>
                <h2>Session Details</h2>
                <p><strong>ID:</strong> {session.id}</p>
                <p><strong>Date:</strong> {new Date(session.createdAt).toLocaleString()}</p>
                <p><strong>Status:</strong> <span className={`status-${session.status.toLowerCase()}`}>{session.status}</span></p>
            </header>

            {session.audioUrl && (
                <section className="audio-player-container">
                    <h3>Session Recording</h3>
                    <audio controls src={session.audioUrl} style={{ width: '100%' }}>
                        Your browser does not support the audio element.
                    </audio>
                </section>
            )}

            {session.transcription && (
                <section className="transcription-container">
                    <h3>Transcription</h3>
                    <p className="transcription">{session.transcription}</p>
                </section>
            )}

            <GenAIPrompt sessionId={sessionId} />
        </div>
    );
};

export default SessionDetail;
