
import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import '../style.css';
import Login from './Login';
import SessionDetail from './SessionDetail';
import { startRecording } from '../utils/recorder';
import { useSessions, useDeleteAccountMutation } from '../../dataconnect-generated/react/hooks';

const MainApp = ({ user, loading }: { user: User | null, loading: boolean }) => {
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const { data, loading: sessionsLoading, error } = useSessions({ skip: !user });
    const [deleteAccount, { loading: deleteLoading, error: deleteError }] = useDeleteAccountMutation();

    const handleLogout = () => {
        signOut(auth);
    };

    const handleStartRecording = () => {
        if (user) {
            const hasBeenPrompted = localStorage.getItem('hasBeenPromptedForPip');
            const pipWindow = window.open('/pip.html', 'Verbatim PIP', 'width=400,height=150,scrollbars=no,resizable=no');

            if (!pipWindow && !hasBeenPrompted) {
                alert('Please allow pop-ups for this site to use the recording feature.');
                localStorage.setItem('hasBeenPromptedForPip', 'true');
            } else if (pipWindow) {
                pipWindow.onload = () => {
                    startRecording();
                };
            }
        } else {
            alert("Please log in to start a new session.");
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This will permanently delete all your data.")) {
            try {
                await deleteAccount();
                alert("Account deleted successfully.");
                handleLogout();
            } catch (error)
 {
                console.error("Error deleting account:", error);
                alert("Failed to delete account. Please try again.");
            }
        }
    };

    if (loading || sessionsLoading) {
        return <div className="loading-indicator"><div></div></div>;
    }

    if (!user) {
        return <Login />;
    }

    return (
        <>
            <header>
                <h1>Verbatim</h1>
                <div>
                    <span>{user.email}</span>
                    <button onClick={handleLogout} className="secondary-button">Logout</button>
                    <button onClick={handleDeleteAccount} className="secondary-button" disabled={deleteLoading}>
                        {deleteLoading ? 'Deleting...' : 'Delete Account'}
                    </button>
                </div>
            </header>
            <div className="main-app-container">
                <div className="sidebar">
                    <button onClick={handleStartRecording} className="primary-button">Start New Session</button>
                    <h2>Previous Sessions</h2>
                    {error && <p>Error loading sessions: {error.message}</p>}
                    {deleteError && <p>Error deleting account: {deleteError.message}</p>}
                    {data && data.sessions && (
                        <ul>
                            {data.sessions.map((session: any) => (
                                <li key={session.id} onClick={() => setSelectedSession(session.id)} className={selectedSession === session.id ? 'active' : ''}>
                                    <p><strong>Session ID:</strong> {session.id}</p>
                                    <p><strong>Created:</strong> {new Date(session.createdAt).toLocaleString()}</p>
                                    <p><strong>Status:</strong> {session.status}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <main>
                    {selectedSession ? (
                        <SessionDetail sessionId={selectedSession} onBack={() => setSelectedSession(null)} />
                    ) : (
                        <div className="no-session-selected">
                            <h2>Welcome to Verbatim</h2>
                            <p>Select a session from the list to view its details, or start a new session.</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default MainApp;
