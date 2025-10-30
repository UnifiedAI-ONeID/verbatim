
import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import '../style.css';
import Login from './Login';
import SessionDetail from './SessionDetail';
import { useSessions } from '../hooks/useSessions';
import { createTodo } from '../../dataconnect-generated';

const MainApp = ({ user, loading }: { user: User | null, loading: boolean }) => {
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useSessions();

    const handleLogout = () => {
        signOut(auth);
    };

    const handleStartNewSession = async () => {
        if (user) {
            try {
                const newTodo = await createTodo({ title: 'New Session' });
                setSelectedSession(newTodo.id);
            } catch (error) {
                console.error("Error creating new session:", error);
                alert("Failed to create a new session. Please try again.");
            }
        } else {
            alert("Please log in to start a new session.");
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This will permanently delete all your data.")) {
            try {
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
                    <button onClick={handleDeleteAccount} className="secondary-button">
                        Delete Account
                    </button>
                </div>
            </header>
            <div className="main-app-container">
                <div className="sidebar">
                    <button onClick={handleStartNewSession} className="primary-button">Start New Session</button>
                    <h2>Previous Sessions</h2>
                    {sessionsError && <p>Error loading sessions: {sessionsError.message}</p>}
                    {sessions && (
                        <ul>
                            {sessions.map((session: any) => (
                                <li key={session.id} onClick={() => setSelectedSession(session.id)} className={selectedSession === session.id ? 'active' : ''}>
                                    <p><strong>Session ID:</strong> {session.id}</p>
                                    <p><strong>Title:</strong> {session.title}</p>
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
