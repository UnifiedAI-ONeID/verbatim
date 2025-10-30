
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import '../style.css';

const SessionDetail = lazy(() => import('./SessionDetail'));

const MainApp = ({ user }: { user: User }) => {
    const [sessions, setSessions] = useState<DocumentData[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);

    const handleLogout = () => {
        signOut(auth);
    };

    useEffect(() => {
        if (user) {
            const q = query(
                collection(db, "sessions"),
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc")
            );
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const sessionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSessions(sessionsData);
            });
            return () => unsubscribe();
        }
    }, [user]);

    const handleStartRecording = () => {
        const hasBeenPrompted = localStorage.getItem('hasBeenPromptedForPip');
        const pipWindow = window.open('/pip.html', 'Verbatim PIP', 'width=400,height=200');

        if (!pipWindow && !hasBeenPrompted) {
            alert('Please allow pop-ups for this site to use the recording feature.');
            localStorage.setItem('hasBeenPromptedForPip', 'true');
        }
    };

    if (selectedSession) {
        return (
            <Suspense fallback={<p>Loading session...</p>}>
                <SessionDetail sessionId={selectedSession} onBack={() => setSelectedSession(null)} />
            </Suspense>
        );
    }

    return (
        <div className="main-app-container">
            <header>
                <h1>Verbatim</h1>
                <div>
                    <span>{user.email}</span>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>
            <main>
                <button onClick={handleStartRecording}>Start New Session</button>
                <h2>Previous Sessions</h2>
                <ul>
                    {sessions.map(session => (
                        <li key={session.id} onClick={() => setSelectedSession(session.id)}>
                            <p>Session ID: {session.id}</p>
                            <p>Status: {session.status}</p>
                        </li>
                    ))}
                </ul>
            </main>
        </div>
    );
};

export default MainApp;
