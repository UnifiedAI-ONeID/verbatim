
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';

// --- Firebase Integration (v10 Modular SDK) ---
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, query, orderBy, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";

// --- Firebase Configuration ---
const firebaseConfig = {
  projectId: "decisive-design-423516-d6",
  appId: "1:896271682768:web:bc70db273f95145c89e2d5",
  storageBucket: "decisive-design-423516-d6.appspot.com",
  apiKey: "AIzaSyA1lJ-yZohsstKIG3kBZtm7xlMyG-KnN_Q",
  authDomain: "decisive-design-423516-d6.firebaseapp.com",
  messagingSenderId: "896271682768",
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; status: 'processing' | 'completed' | 'error'; error?: string; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';

// --- i18n Translations (Consolidated & Corrected) ---
const translations = {
    en: {
        title: 'Verbatim',
        subtitle: 'Your intelligent meeting dashboard.',
        welcomeUser: 'Welcome, {name}',
        startRecording: '🎤 New Session',
        stopRecording: '⏹️ Stop',
        analyzing: 'Analyzing...',
        processing: 'Processing...',
        micPermissionError: 'Could not start recording. Please grant microphone permissions.',
        processingError: 'Failed to process audio. This can happen due to a poor network connection, a very short recording, or if the audio is silent. Please try again.',
        offlineError: 'Analysis requires an internet connection. Please connect and try again.',
        recordingTooShortError: 'Recording is too short to analyze. Please record for at least 2 seconds.',
        transcriptHeader: '📋 Transcript',
        summaryHeader: '✨ Key Summary',
        actionItemsHeader: '📌 Action Items',
        noTranscript: 'Could not extract transcript.',
        noSummary: 'Could not extract summary.',
        takeAction: 'Take Action ✨',
        noActionDetermined: 'Could not determine a specific action for this item. You can handle it manually.',
        createCalendarEvent: 'Create Google Calendar Event',
        titleLabel: 'Title:',
        descriptionLabel: 'Description:',
        dateLabel: 'Date:',
        timeLabel: 'Time:',
        openInCalendar: 'Open in Google Calendar',
        draftEmail: 'Draft Email',
        toLabel: 'To:',
        subjectLabel: 'Subject:',
        bodyLabel: 'Body:',
        openInEmailApp: 'Open in Email App',
        draftInvoiceEmail: 'Draft Invoice Email',
        recipientNameLabel: 'Recipient Name:',
        amountLabel: 'Amount:',
        invoiceEmailBody: 'Hello {recipientName},\n\nThis is an invoice for the following item:\n- {itemDescription}\n\nAmount Due: {currencySymbol}{amount}\n\nPlease let me know if you have any questions.\n\nBest,\n{userName}',
        initiatePhoneCall: 'Initiate Phone Call',
        phoneNumberLabel: 'Phone Number:',
        reasonLabel: 'Reason:',
        callNow: 'Call Now',
        createDocument: 'Create Google Doc',
        createDocInfo: 'A new tab will open to create a Google Doc. The content below will be copied to your clipboard to paste.',
        suggestedTitle: 'Suggested Title:',
        suggestedContent: 'Suggested Content:',
        openGoogleDocs: 'Open Google Docs & Copy Content',
        unknownAction: 'Unknown Action',
        actionError: 'An error occurred while determining the action. Please try again.',
        exportResults: 'Export Results',
        copyMarkdown: 'Copy as Markdown',
        downloadMarkdown: 'Download as .md',
        copiedSuccess: 'Copied to clipboard!',
        meetingTitle: 'Meeting Notes',
        meetingLocation: 'Location:',
        locationUnavailable: 'Location not available',
        gettingLocation: 'Getting location...',
        speakersHeader: '🗣️ Speakers',
        renameSpeakerPrompt: 'Enter new name for',
        footerText: 'For Impactory Institute Use Only',
        recentSessions: 'Recent Sessions',
        welcomeMessage: 'Welcome to Verbatim',
        welcomeSubtext: 'Your recorded sessions will appear here. Tap the microphone to get started.',
        deleteSession: 'Delete Session?',
        deleteConfirmation: 'Are you sure you want to delete this session? This action cannot be undone.',
        searchPlaceholder: 'Search sessions...',
        toggleMiniView: 'Picture-in-Picture',
        keepAwake: 'Keep Screen Awake',
        keepAwakeInfo: 'Prevents the screen from turning off during a recording session.',
        backToList: 'Back to Sessions',
        recordPhoneCallTitle: 'Recording a Phone Call?',
        recordPhoneCallInstruction: 'For best quality, connect your headset. You can also use your phone\'s speaker. Tap the record button to begin.',
        selectAudioDeviceTitle: 'Select Audio Source',
        selectAudioDeviceInstruction: 'Choose the microphone you want to use for the recording.',
        start: 'Start',
        cancel: 'Cancel',
        actionPrompt: 'You are an intelligent assistant. Based on the full context of a meeting and a specific action item, call the most appropriate tool to help the user complete it. The user\'s language is English. Meeting Title: "{meetingTitle}". Meeting Date: "{meetingDate}". Meeting Summary: "{meetingSummary}". Action Item: "{actionItemText}". Ensure all generated content like email subjects or event descriptions are relevant to the meeting context.',
        faqLink: 'FAQ',
        faqTitle: 'Frequently Asked Questions',
        logout: 'Logout',
        faq: [ { q: 'Whats new?', a: 'Latest AI models and invoice drafting.' } ],
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
        signIn: 'Sign In with Google',
        signOut: 'Sign Out',
        signInToView: 'Sign in to view sessions',
    },
};

// --- Helper Functions ---
const getLanguage = (): Language => {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('zh-cn')) return 'zh-CN';
    if (lang.startsWith('zh')) return 'zh-TW';
    return 'en';
};

const t = translations[getLanguage()] || translations.en;

const App = () => {
    // --- State Management ---
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
    const [showFaq, setShowFaq] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [keepAwake, setKeepAwake] = useState(false);

    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const wakeLockRef = useRef<any>(null);

    // --- Authentication ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setIsLoading(true);
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                await setDoc(userDocRef, { name: firebaseUser.displayName, email: firebaseUser.email }, { merge: true });
                setUser(firebaseUser);
            } else {
                setUser(null);
                setSessions([]);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Session Data Fetching ---
    useEffect(() => {
        if (!user) return;
        const sessionsColRef = collection(db, 'users', user.uid, 'sessions');
        const q = query(sessionsColRef, orderBy('metadata.date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(userSessions);
        }, (err) => {
            console.error("Error fetching sessions:", err);
            setError("Could not load sessions.");
        });
        return () => unsubscribe();
    }, [user]);

    // --- Auth Functions ---
    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Authentication error:", error);
            setError("Failed to sign in with Google.");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setSelectedSession(null);
            setActiveTab('record');
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };
    
    // --- Recording Logic ---
    const handleStartRecording = async () => {
        if (!user) {
            await signInWithGoogle();
            return;
        }
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAvailableDevices(devices.filter(d => d.kind === 'audioinput'));
            setShowDeviceSelector(true);
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.error("Microphone access error:", err);
            setError(t.micPermissionError);
        }
    };

    const handleDeviceSelected = async (deviceId: string) => {
        if (!user) return;
        setShowDeviceSelector(false);
        audioChunksRef.current = [];
        
        const newSessionId = \`session_\${Date.now()}\`;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);

            mediaRecorderRef.current.onstop = async () => {
                setIsSaving(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
                if (recordingTime < 2) {
                    setError(t.recordingTooShortError);
                    setIsSaving(false);
                    return;
                }

                try {
                    const storageRef = ref(storage, \`recordings/\${user.uid}/\${newSessionId}.webm\`);
                    await uploadBytes(storageRef, audioBlob);
                    
                    const sessionDocRef = doc(db, 'users', user.uid, 'sessions', newSessionId);
                    const preliminarySession: Omit<Session, 'id' | 'results' | 'speakers'> = {
                        metadata: {
                            title: \`Meeting - \${new Date().toLocaleString()}\`,
                            date: new Date().toISOString(),
                            location: 'TBD',
                            mapUrl: ''
                        },
                        status: 'processing',
                    };
                    await setDoc(sessionDocRef, preliminarySession);
                    setSelectedSession({ ...preliminarySession, id: newSessionId, results: { transcript: '', summary: '', actionItems: [] }, speakers: {} });
                    
                    const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                    await analyzeAudio({ sessionId: newSessionId });

                } catch (e) {
                    console.error("Error saving session:", e);
                    setError("Failed to save your recording.");
                    const sessionDocRef = doc(db, 'users', user.uid, 'sessions', newSessionId);
                    await deleteDoc(sessionDocRef);
                } finally {
                    setIsSaving(false);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);

            if (keepAwake && 'wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            setError(t.micPermissionError);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current!);
            if (wakeLockRef.current) wakeLockRef.current.release();
        }
    };

    // --- Data Handling ---
    const handleDeleteSession = async (sessionId: string) => {
        if (user && window.confirm(t.deleteConfirmation)) {
            await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
            if (selectedSession?.id === sessionId) setSelectedSession(null);
        }
    };
    
    const handleRenameSpeaker = async (sessionId: string, speakerId: string, newName: string) => {
        if (user && newName.trim()) {
            const sessionDocRef = doc(db, 'users', user.uid, 'sessions', sessionId);
            const sessionToUpdate = sessions.find(s => s.id === sessionId);
            const updatedSpeakers = { ...sessionToUpdate?.speakers, [speakerId]: newName.trim() };
            await updateDoc(sessionDocRef, { speakers: updatedSpeakers });
        }
        setEditingSpeaker(null);
    };

    const handleTakeAction = async (actionItem: string, session: Session) => {
        setIsSaving(true);
        try {
            const prompt = t.actionPrompt
                .replace('{meetingTitle}', session.metadata.title)
                .replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString())
                .replace('{meetingSummary}', session.results.summary)
                .replace('{actionItemText}', actionItem);
            
            const determineAction = httpsCallable(functions, 'determineAction');
            const result: HttpsCallableResult<ActionModalData> = await determineAction({ prompt });
            
            setShowActionModal({...result.data, sourceItem: actionItem});

        } catch (error) {
            setError(t.actionError);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredSessions = sessions.filter(s =>
        s.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.results?.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="app-container">
            <style>{globalStyles}</style>
            <main>
                {selectedSession ? (
                    <SessionDetail
                        session={selectedSession}
                        onBack={() => setSelectedSession(null)}
                        onTakeAction={handleTakeAction}
                        onRenameSpeaker={handleRenameSpeaker}
                        editingSpeaker={editingSpeaker}
                        setEditingSpeaker={setEditingSpeaker}
                    />
                ) : (
                   <>
                        {activeTab === 'record' && (
                            <RecordScreen
                                user={user}
                                isRecording={isRecording}
                                recordingTime={recordingTime}
                                onStart={handleStartRecording}
                                onStop={handleStopRecording}
                                keepAwake={keepAwake}
                                onKeepAwakeChange={setKeepAwake}
                                onSignIn={signInWithGoogle}
                            />
                        )}
                        {activeTab === 'sessions' && (
                             <SessionList
                                sessions={filteredSessions}
                                onSelectSession={setSelectedSession}
                                onDeleteSession={handleDeleteSession}
                                searchQuery={searchQuery}
                                onSearchChange={(e) => setSearchQuery(e.target.value)}
                                user={user}
                                onShowFaq={() => setShowFaq(true)}
                                onSignOut={handleSignOut}
                            />
                        )}
                   </>
                )}
            </main>

            {!selectedSession && !isRecording && (
                <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            )}

            {isSaving && <LoadingModal text={t.processing} />}
            {error && <ErrorModal message={error} onClose={() => setError(null)} />}
            {showActionModal && <ActionModal data={showActionModal} onClose={() => setShowActionModal(null)} user={user} />}
            {showDeviceSelector && <AudioDeviceSelector devices={availableDevices} onDeviceSelected={handleDeviceSelected} onClose={() => setShowDeviceSelector(false)} />}
            {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
        </div>
    );
};

// --- Components ---
const RecordScreen = ({ user, isRecording, recordingTime, onStart, onStop, keepAwake, onKeepAwakeChange, onSignIn }) => {
    const formatTime = (seconds) => \`\${Math.floor(seconds / 60).toString().padStart(2, '0')}:\${(seconds % 60).toString().padStart(2, '0')}\`;

    return (
        <div className="record-screen">
            {user ? (
                <>
                    <div className="timer-display">{formatTime(recordingTime)}</div>
                    <button onClick={isRecording ? onStop : onStart} className={\`mic-button \${isRecording ? 'stop' : 'start'}\`}>
                        {isRecording ? '⏹️' : '🎤'}
                    </button>
                    {!isRecording && (
                        <div className="keep-awake-toggle">
                            <label>
                                <input type="checkbox" checked={keepAwake} onChange={e => onKeepAwakeChange(e.target.checked)} />
                                {t.keepAwake}
                            </label>
                        </div>
                    )}
                </>
            ) : (
                <button onClick={onSignIn} className="modal-button">{t.signIn}</button>
            )}
        </div>
    );
};

const SessionList = ({ sessions, onSelectSession, onDeleteSession, searchQuery, onSearchChange, user, onShowFaq, onSignOut }) => (
    <div className="page-container">
        <div className="page-header">
             <h1 className="page-title">{t.sessions}</h1>
             {user && <button onClick={onSignOut}>{t.signOut}</button>}
             <button onClick={onShowFaq}>?</button>
        </div>
        <input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={onSearchChange} />
        <ul className="session-list">
            {sessions.map(session => (
                <li key={session.id} onClick={() => onSelectSession(session)}>
                    <h3>{session.metadata.title}</h3>
                    <p>{new Date(session.metadata.date).toLocaleString()}</p>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}>🗑️</button>
                </li>
            ))}
        </ul>
    </div>
);

const SessionDetail = ({ session, onBack, onTakeAction, onRenameSpeaker, editingSpeaker, setEditingSpeaker }) => {
    const generateMarkdown = (s) => \`# \${s.metadata.title}\n\n\${s.results.summary}\`;
    const handleCopy = () => navigator.clipboard.writeText(generateMarkdown(session));
    
    return (
        <div className="session-detail">
            <button onClick={onBack}>&larr; {t.backToList}</button>
            <h2>{session.metadata.title}</h2>
            <button onClick={handleCopy}>{t.copyMarkdown}</button>
            
            <Accordion title={t.summaryHeader} defaultOpen>
                <p>{session.results.summary}</p>
            </Accordion>
            
            <Accordion title={t.actionItemsHeader} defaultOpen>
                <ul>
                    {session.results.actionItems.map((item, i) => (
                        <li key={i}>
                            {item}
                            <button onClick={() => onTakeAction(item, session)}>{t.takeAction}</button>
                        </li>
                    ))}
                </ul>
            </Accordion>

            <Accordion title={t.speakersHeader}>
                {Object.entries(session.speakers).map(([id, name]) => (
                    <div key={id}>
                        {editingSpeaker?.speakerId === id ? (
                            <input
                                type="text"
                                defaultValue={name as string}
                                onBlur={(e) => onRenameSpeaker(session.id, id, e.target.value)}
                                autoFocus
                            />
                        ) : (
                            <span onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })}>{name as string} ✏️</span>
                        )}
                    </div>
                ))}
            </Accordion>
            
            <Accordion title={t.transcriptHeader}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{session.results.transcript}</p>
            </Accordion>
        </div>
    );
};

const Modal = ({ children, onClose, title }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{title}</h2>
            <button onClick={onClose}>&times;</button>
            {children}
        </div>
    </div>
);

const ActionModal = ({ data, onClose, user }) => {
    const { type, args } = data;
    // A simple display for any action
    return <Modal onClose={onClose} title="Suggested Action"><p>Action: {type}</p><pre>{JSON.stringify(args, null, 2)}</pre></Modal>;
};

const AudioDeviceSelector = ({ devices, onDeviceSelected, onClose }) => (
    <Modal onClose={onClose} title={t.selectAudioDeviceTitle}>
        <select onChange={e => onDeviceSelected(e.target.value)} defaultValue="">
            <option value="" disabled>Select a device</option>
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
    </Modal>
);

const FaqModal = ({ onClose }) => <Modal onClose={onClose} title={t.faqTitle}><p>{t.faq[0].a}</p></Modal>;
const ErrorModal = ({ message, onClose }) => <Modal onClose={onClose} title="Error"><p>{message}</p></Modal>;
const LoadingModal = ({ text }) => <div className="modal-overlay"><div className="loading-content">{text}</div></div>;
const LoadingSpinner = () => <div className="loading-spinner"></div>;

const BottomNav = ({ activeTab, onTabChange }) => (
    <nav className="bottom-nav">
        <button onClick={() => onTabChange('record')} className={activeTab === 'record' ? 'active' : ''}>{t.record}</button>
        <button onClick={() => onTabChange('sessions')} className={activeTab === 'sessions' ? 'active' : ''}>{t.sessions}</button>
    </nav>
);

const Accordion = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="accordion-item">
            <h3 onClick={() => setIsOpen(!isOpen)}>{title}</h3>
            {isOpen && <div className="accordion-content">{children}</div>}
        </div>
    );
};

// --- Global Styles ---
const globalStyles = \`
    /* Minimal styles for functionality */
    body { font-family: sans-serif; background: #121212; color: #eee; }
    .app-container { max-width: 800px; margin: 0 auto; padding: 1rem; }
    .mic-button { font-size: 2rem; width: 100px; height: 100px; border-radius: 50%; }
    .mic-button.stop { background: red; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: #333; padding: 2rem; border-radius: 8px; }
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; background: #222; padding: 1rem; }
    .accordion-item h3 { cursor: pointer; }
\`;

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
