
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
            <button onClick={onBack} className="secondary-button">Back to Sessions</button>
            <header>
                <h2>Session on {new Date(session.createdAt).toLocaleString()}</h2>
                <p>Status: {session.status}</p>
            </header>

            {session.audioUrl && (
                <div className="audio-player-container">
                    <h3>Session Recording</h3>
                    <audio controls src={session.audioUrl}>
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {session.transcription && (
                <div className="transcription-container">
                    <h3>Transcription</h3>
                    <p className="transcription">{session.transcription}</p>
                </div>
            )}

            <GenAIPrompt sessionId={sessionId} />
        </div>
    );
};

export default SessionDetail;
