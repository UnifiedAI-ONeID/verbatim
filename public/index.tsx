
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// Import services and configurations
import { auth, db, storage, functions, ai } from './services';
import { tools } from './config';
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from "firebase/auth";
import { collection, doc, setDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, deleteObject } from "firebase/storage";

// Import types
import { Session, ActionModalData, EditingSpeaker, ActiveTab } from './types';

// Import contexts and providers
import { ThemeProvider, LanguageProvider, useLocalization, useTheme } from './contexts';

// Import custom hooks
import { useKeepAwake } from './hooks';

// Import all sub-components
import {
    Header,
    RecordView,
    SessionsListView,
    SessionDetailView,
    BottomNav,
    LoginView,
    Modal,
    ActionModal,
    DedicationModal,
    FirebaseConfigWarning,
    LoadingSpinner
} from './components';

// Import styles
import { injectGlobalStyles } from './styles';

// --- Main App Component ---
const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showActionModal, setShowActionModal] = useState<ActionModalData | null>(null);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(() => JSON.parse(localStorage.getItem('verbatim_keepAwake') || 'false'));
    const [showDedication, setShowDedication] = useState(false);
    const { t } = useLocalization();
    const { requestWakeLock, releaseWakeLock } = useKeepAwake();
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const logoClickCount = useRef(0);
    const pipWindowRef = useRef<Window | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const isRecordingRef = useRef(isRecording);
    const recordingTimeRef = useRef(recordingTime);
    
    useEffect(() => {
        isRecordingRef.current = isRecording;
        recordingTimeRef.current = recordingTime;
    }, [isRecording, recordingTime]);

    const handleLogoClick = () => {
        logoClickCount.current += 1;
        if (logoClickCount.current >= 5) {
            setShowDedication(true);
            setTimeout(() => (logoClickCount.current = 0), 2000); // Reset after a delay
        }
    };

    const signInWithGoogle = useCallback(async (): Promise<User | null> => {
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Sign-in successful for user:", result.user.displayName);
            return result.user;
        } catch (error: any) {
            console.error("Authentication error:", error.code, error.message);
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                case 'auth/cancelled-popup-request':
                    // User intentionally closed the popup, so no error message is needed.
                    break;
                case 'auth/popup-blocked':
                    setError(t.signInPopupBlockedError);
                    break;
                default:
                    setError(`${t.signInError} (${error.code})`);
                    break;
            }
            return null;
        }
    }, [t]);

    // Register Service Worker for PWA
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => {
            if (u) {
                console.log(`Auth state changed: User signed in as ${u.displayName} (${u.uid})`);
            } else {
                console.log("Auth state changed: User signed out.");
            }
            setUser(u);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) { setSessions([]); return; }
        const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('metadata.date', 'desc'));
        const unsub = onSnapshot(q,
            (snap) => {
                const sessionData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
                console.log(`Firestore listener: Received ${sessionData.length} sessions for user ${user.uid}.`);
                setSessions(sessionData);
            },
            (error) => {
                console.error("Firestore listener error:", error);
                setError("Could not load sessions due to a database error.");
            }
        );
        return () => unsub();
    }, [user]);

    useEffect(() => localStorage.setItem('verbatim_keepAwake', JSON.stringify(keepAwakeEnabled)), [keepAwakeEnabled]);

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        releaseWakeLock();
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
        }
    }, [releaseWakeLock]);

    const openPipWindow = useCallback(async () => {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            pipWindowRef.current.focus();
            return;
        }
        const pipWindow = window.open('/pip.html', 'verbatim_pip', 'width=400,height=120,popup');
        pipWindowRef.current = pipWindow;
    }, []);

    // Effect for PiP BroadcastChannel listener
    useEffect(() => {
        const channel = new BroadcastChannel('verbatim_pip_channel');
        channelRef.current = channel;

        const messageHandler = (event: MessageEvent) => {
            if (event.data.type === 'stop_recording') {
                handleStopRecording();
            } else if (event.data.type === 'pip_ready') {
                if (channelRef.current) {
                    channelRef.current.postMessage({
                        type: 'state_update',
                        isRecording: isRecordingRef.current,
                        recordingTime: recordingTimeRef.current,
                    });
                }
            }
        };
        channel.addEventListener('message', messageHandler);
        return () => {
            channel.removeEventListener('message', messageHandler);
            channel.close();
        };
    }, [handleStopRecording]);
    
    // Effect for sending state updates to PiP window
    useEffect(() => {
        if (channelRef.current && pipWindowRef.current && !pipWindowRef.current.closed) {
            channelRef.current.postMessage({
                type: 'state_update',
                isRecording,
                recordingTime,
            });
        }
        if (!isRecording && pipWindowRef.current && !pipWindowRef.current.closed) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
        }
    }, [isRecording, recordingTime]);
    
    const handleStartRecording = async (deviceId: string) => {
        if (!auth.currentUser) return;
        const currentUser = auth.currentUser;
        setShowDeviceSelector(false);
        audioChunksRef.current = [];
    
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        } catch (err) {
            console.error("Recording setup failed: Could not get user media.", err);
            setError(t.micPermissionError);
            return; // Exit early if we can't get the mic
        }
        
        // Now that we have the stream, we can create the session
        const newSessionId = `session_${Date.now()}`;
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSessionId);
    
        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })).catch(() => null);
            let locationName = t.locationUnavailable, mapUrl = '';
            if (pos) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                    if (res.ok) { const data = await res.json(); locationName = data.display_name; mapUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`; }
                } catch (e) {
                    console.warn("Could not fetch location name", e);
                }
            }
    
            const preliminarySession: Omit<Session, 'id' | 'results' | 'speakers'> = { metadata: { title: `Meeting - ${new Date().toLocaleString()}`, date: new Date().toISOString(), location: locationName, mapUrl }, status: 'processing' };
            await setDoc(sessionDocRef, preliminarySession);
            console.log(`Firestore: Created preliminary session document ${newSessionId}`);
            const newSessionData = { ...preliminarySession, id: newSessionId, results: { transcript: '', summary: '', actionItems: [] }, speakers: {} };
            setSelectedSession(newSessionData);
            setActiveTab('sessions');
    
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            
            mediaRecorderRef.current.onstop = async () => {
                setIsSaving(true);
                releaseWakeLock();
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
    
                if (audioBlob.size < 2000) {
                    setError(t.recordingTooShortError);
                    console.log(`Firestore: Deleting session ${newSessionId} due to short recording.`);
                    await deleteDoc(sessionDocRef);
                } else if (!navigator.onLine) {
                    setError(t.offlineError);
                    console.log(`Firestore: Marking session ${newSessionId} as error due to offline status.`);
                    await updateDoc(sessionDocRef, { status: 'error', error: t.offlineError });
                } else {
                    try {
                        const storageRef = ref(storage, `recordings/${currentUser.uid}/${newSessionId}.webm`);
                        console.log(`Storage: Uploading recording for session ${newSessionId}...`);
                        await uploadBytes(storageRef, audioBlob);
                        console.log(`Storage: Upload successful for session ${newSessionId}.`);
                        
                        const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                        console.log(`Functions: Calling analyzeAudio for session ${newSessionId}...`);
                        await analyzeAudio({ sessionId: newSessionId, prompt: t.analysisPrompt });
                        console.log("Functions: analyzeAudio call successful.");
                    } catch (e) {
                        console.error("Functions: analyzeAudio call failed.", e);
                        setError(t.processingError);
                        await updateDoc(sessionDocRef, { status: 'error', error: t.processingError });
                    }
                }
                setIsSaving(false);
            };
    
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
            if (keepAwakeEnabled) requestWakeLock();
        } catch (err) {
            console.error("Session creation or recording start failed:", err);
            setError(t.processingError); // A more generic error
            // The doc might have been created, so try to clean up.
            await deleteDoc(sessionDocRef).catch(() => {});
            // Stop the stream tracks if they are active
            stream.getTracks().forEach(track => track.stop());
        }
    };
    
    const handleStartRecordingClick = async () => {
        setError(null);
        if(!user) {
            const signedInUser = await signInWithGoogle();
            if (!signedInUser) return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
            setAvailableDevices(devices);
            setShowDeviceSelector(true);
            stream.getTracks().forEach(track => track.stop());
        } catch (err) { setError(t.micPermissionError); }
    };
    
    const handleDeleteSession = async (sessionId: string) => {
        if (!user || !window.confirm(t.deleteConfirmation)) return;
        console.log(`Attempting to delete session ${sessionId}...`);
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
            console.log(`Firestore: Deleted document for session ${sessionId}.`);
            await deleteObject(ref(storage, `recordings/${user.uid}/${sessionId}.webm`));
            console.log(`Storage: Deleted file for session ${sessionId}.`);
            setSelectedSession(null);
        } catch (error) {
            console.error(`Failed to delete session ${sessionId}:`, error);
            setError("Failed to delete session.");
        }
    };

    const handleUpdateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user || !newName.trim()) return;
        console.log(`Firestore: Updating speaker name for session ${sessionId}, speaker ${speakerId} to "${newName.trim()}"`);
        try {
            await updateDoc(doc(db, 'users', user.uid, 'sessions', sessionId), { [`speakers.${speakerId}`]: newName.trim() });
            setEditingSpeaker(null);
        } catch (error) {
            console.error("Firestore: Failed to update speaker name.", error);
            setError("Failed to update speaker name.");
        }
    };

    const handleTakeAction = async (item: string, session: Session) => {
        try {
            const prompt = t.actionPrompt.replace('{meetingTitle}', session.metadata.title).replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString()).replace('{meetingSummary}', session.results.summary).replace('{actionItemText}', item);
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }], config: { tools: [{ functionDeclarations: tools }] } });
            const call = response.functionCalls?.[0];
            if (call) setShowActionModal({ type: call.name, args: call.args, sourceItem: item });
            else setShowActionModal({ type: 'unknown', sourceItem: item });
        } catch (err) { setShowActionModal({ type: 'error' }); }
    };
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingSpinner />
                </div>
            );
        }
        if (selectedSession) return <SessionDetailView session={selectedSession} onBack={() => setSelectedSession(null)} onDelete={handleDeleteSession} onTakeAction={handleTakeAction} onUpdateSpeakerName={handleUpdateSpeakerName} editingSpeaker={editingSpeaker} setEditingSpeaker={setEditingSpeaker} />;
        if (activeTab === 'sessions') return user ? <SessionsListView sessions={sessions} onSelectSession={setSelectedSession} searchQuery={searchQuery} setSearchQuery={setSearchQuery} /> : <LoginView prompt={t.signInToView} onSignIn={signInWithGoogle} error={error} />;
        return <RecordView isRecording={isRecording} recordingTime={recordingTime} isSaving={isSaving} error={error} user={user} onStopRecording={handleStopRecording} onStartRecordingClick={handleStartRecordingClick} keepAwake={keepAwakeEnabled} setKeepAwake={setKeepAwakeEnabled} onTogglePip={openPipWindow} />;
    };

    return (
        <FirebaseConfigWarning>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--bg)' }}>
                <Header user={user} onSignIn={signInWithGoogle} onLogoClick={handleLogoClick} />
                <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '70px', display: 'flex', flexDirection: 'column' }}>{renderContent()}</main>
                {!selectedSession && <BottomNav activeTab={activeTab} setActiveTab={(tab) => {setSelectedSession(null); setActiveTab(tab)}} />}
                {showDeviceSelector && <Modal title={t.selectAudioDeviceTitle} onClose={() => setShowDeviceSelector(false)}><p>{t.selectAudioDeviceInstruction}</p><ul style={{listStyle: 'none', padding: 0, margin: '10px 0 0'}}>{availableDevices.map((d, i) => <li key={d.deviceId} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', textAlign: 'center', backgroundColor: 'var(--bg-3)', transition: 'background-color 0.2s' }} onClick={() => handleStartRecording(d.deviceId)}>{d.label || `Mic ${i + 1}`}</li>)}</ul></Modal>}
                {showActionModal && <ActionModal data={showActionModal} user={user} onClose={() => setShowActionModal(null)} />}
                {showDedication && <DedicationModal onClose={() => setShowDedication(false)} />}
            </div>
        </FirebaseConfigWarning>
    );
};

// --- Inject global styles and render the app ---
injectGlobalStyles();
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </ThemeProvider>
    </React.StrictMode>
);
