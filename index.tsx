
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
const functions = getFunctions(app);
const storage = getStorage(app);

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Session = { id: string; metadata: any; results: any; speakers: any; status: 'processing' | 'completed' | 'error'; error?: string; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';

// --- i18n Translations (Full & Final) ---
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
        faq: [ { q: 'What\'s new?', a: 'This version uses the latest AI models for more accurate analysis and introduces a "Draft Invoice" action for financial tasks.' } ],
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
        signIn: 'Sign In with Google',
        signOut: 'Sign Out',
        signInToView: 'Sign in to view sessions',
    },
};

const getLanguage = (): Language => (navigator.language.split('-')[0] as Language) || 'en';
const t = translations[getLanguage()] || translations.en;

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
    const [showFaq, setShowFaq] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [keepAwake, setKeepAwake] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const wakeLockRef = useRef<any>(null);
    const pipChannelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, u => {
            setUser(u);
            if (!u) setSessions([]);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('metadata.date', 'desc'));
        const unsubscribe = onSnapshot(q, snap => setSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Session))));
        return () => unsubscribe();
    }, [user]);

    const handleStartRecording = async () => {
        if (!user) { signInWithGoogle(); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAvailableDevices((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'));
            setShowDeviceSelector(true);
            stream.getTracks().forEach(t => t.stop());
        } catch (e) { setError(t.micPermissionError); }
    };

    const handleDeviceSelected = async (deviceId: string) => {
        if (!user) return;
        setShowDeviceSelector(false);
        audioChunksRef.current = [];
        const newSessionId = \`session_\${Date.now()}\`;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = async () => {
            setIsSaving(true);
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (recordingTime < 2) { setError(t.recordingTooShortError); setIsSaving(false); return; }

            try {
                const storageRef = ref(storage, \`recordings/\${user.uid}/\${newSessionId}.webm\`);
                await uploadBytes(storageRef, audioBlob);
                const sessionDocRef = doc(db, 'users', user.uid, 'sessions', newSessionId);
                await setDoc(sessionDocRef, {
                    metadata: { title: \`Meeting - \${new Date().toLocaleString()}\`, date: new Date().toISOString() },
                    status: 'processing'
                });
                setSelectedSession({ id: newSessionId, status: 'processing' } as Session);
                await httpsCallable(functions, 'analyzeAudio')({ sessionId: newSessionId });
            } catch (e) { setError("Failed to save recording."); } 
            finally { setIsSaving(false); }
            stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        recordingIntervalRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
        if (keepAwake) wakeLockRef.current = await (navigator as any).wakeLock?.request('screen');
    };

    const handleStopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        clearInterval(recordingIntervalRef.current!);
        wakeLockRef.current?.release();
        pipChannelRef.current.postMessage({ type: 'stop' });
    };

    const handleTakeAction = async (actionItem: string, session: Session) => {
        setIsSaving(true);
        try {
            const prompt = t.actionPrompt.replace('{...}', actionItem); // Simplified
            const result: HttpsCallableResult<ActionModalData> = await httpsCallable(functions, 'determineAction')({ prompt });
            setShowActionModal({ ...result.data, sourceItem: actionItem });
        } catch (e) { setError(t.actionError); }
        finally { setIsSaving(false); }
    };
    
    // --- Other handlers ---
    const signInWithGoogle = async () => { await signInWithPopup(auth, new GoogleAuthProvider()); };
    const handleSignOut = async () => { await signOut(auth); };
    const handleDeleteSession = async (id: string) => { if (user) await deleteDoc(doc(db, 'users', user.uid, 'sessions', id)); };
    const handleRenameSpeaker = async (sessionId, speakerId, newName) => {
        if (user && newName.trim()) {
            const docRef = doc(db, 'users', user.uid, 'sessions', sessionId);
            await updateDoc(docRef, { [\`speakers.\${speakerId}\`]: newName.trim() });
        }
        setEditingSpeaker(null);
    };

    if (isLoading) return <LoadingSpinner />;
    
    // --- UI Rendering ---
    return (
        <div className="app-container">
            <style>{globalStyles}</style>
            <main>
                {selectedSession ? (
                    <SessionDetail {...{ session: selectedSession, onBack: () => setSelectedSession(null), onTakeAction, onRenameSpeaker, editingSpeaker, setEditingSpeaker }} />
                ) : (
                    activeTab === 'record' ?
                        <RecordScreen {...{ user, isRecording, recordingTime, onStart: handleStartRecording, onStop: handleStopRecording, keepAwake, onKeepAwakeChange: setKeepAwake, onSignIn: signInWithGoogle }} /> :
                        <SessionList {...{ sessions, onSelectSession: setSelectedSession, onDeleteSession: handleDeleteSession, user, onShowFaq: () => setShowFaq(true), onSignOut: handleSignOut, searchQuery, onSearchChange: e => setSearchQuery(e.target.value) }} />
                )}
            </main>
            {!selectedSession && !isRecording && <BottomNav {...{ activeTab, onTabChange: setActiveTab }} />}
            {isSaving && <LoadingModal text={t.processing} />}
            {error && <ErrorModal {...{ message: error, onClose: () => setError(null) }} />}
            {showActionModal && <ActionModal {...{ data: showActionModal, onClose: () => setShowActionModal(null), user }} />}
            {showDeviceSelector && <AudioDeviceSelector {...{ devices: availableDevices, onDeviceSelected: handleDeviceSelected, onClose: () => setShowDeviceSelector(false) }} />}
            {showFaq && <FaqModal {...{ onClose: () => setShowFaq(false) }} />}
        </div>
    );
};

// --- Components (Styled & Final) ---
const RecordScreen = ({ user, isRecording, recordingTime, onStart, onStop, keepAwake, onKeepAwakeChange, onSignIn }) => {
    const formatTime = (s: number) => \`\${Math.floor(s/60).toString().padStart(2,'0')}:\${(s%60).toString().padStart(2,'0')}\`;
    return (
        <div className="record-screen">
            {user ? (
                <div className={`record-screen-content ${isRecording ? 'is-recording' : ''}`}>
                    <p className="record-status-text">{isRecording ? t.recording : t.tapToRecord}</p>
                    <div className="timer-display">{formatTime(recordingTime)}</div>
                    <button onClick={isRecording ? onStop : onStart} className={`mic-button ${isRecording ? 'stop' : 'start'}`} />
                    <div className="record-screen-options">
                        {!isRecording && (
                            <div className="keep-awake-container">
                                <label className="keep-awake-label-container">
                                    <span className="keep-awake-label">{t.keepAwake}</span>
                                    <div className="switch"><input type="checkbox" checked={keepAwake} onChange={e => onKeepAwakeChange(e.target.checked)} /><span className="slider round"></span></div>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            ) : ( <button onClick={onSignIn} className="modal-button">{t.signIn}</button> )}
        </div>
    );
};

const SessionList = ({ sessions, onSelectSession, onDeleteSession, user, onSignOut, searchQuery, onSearchChange, onShowFaq }) => (
    <div className="page-container">
        <div className="page-header">
            <h1 className="page-title">{t.sessions}</h1>
            <div className="header-actions">
                {user && <button onClick={onSignOut} className="signout-button">{t.signOut}</button>}
                <button onClick={onShowFaq} className="faq-button">?</button>
            </div>
        </div>
        <input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={onSearchChange} className="search-input"/>
        <ul className="session-list">
            {sessions.filter(s => s.metadata.title.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                <li key={s.id} className="session-item" onClick={() => onSelectSession(s)}>
                    <div className="session-item-content">
                        <h3>{s.metadata.title}</h3>
                        <p>{new Date(s.metadata.date).toLocaleString()}</p>
                        {s.status === 'completed' && <p className="summary-preview">{(s.results.summary || '').slice(0, 100)}...</p>}
                        {s.status === 'processing' && <div className="processing-indicator"><div className="spinner-small"/> {t.processing}</div>}
                    </div>
                    <button className="delete-btn" onClick={e => { e.stopPropagation(); onDeleteSession(s.id); }}>🗑️</button>
                </li>
            ))}
        </ul>
    </div>
);

const SessionDetail = ({ session, onBack, onTakeAction, onRenameSpeaker, editingSpeaker, setEditingSpeaker }) => {
    const generateMarkdown = s => \`# \${s.metadata.title}\n\n\${s.results.summary}\`;
    return (
        <div className="page-container session-detail">
            <div className="page-header sticky">
                <button onClick={onBack} className="back-btn">&larr; {t.backToList}</button>
                <div className="export-buttons"><button onClick={() => navigator.clipboard.writeText(generateMarkdown(session))}>{t.copyMarkdown}</button></div>
            </div>
            <h2>{session.metadata.title}</h2>
            <Accordion title={t.summaryHeader} defaultOpen={true}><p>{session.results.summary}</p></Accordion>
            <Accordion title={t.actionItemsHeader} defaultOpen={true}>
                <ul>{session.results.actionItems.map((item, i) => <li key={i}><span>{item}</span><button className="action-btn" onClick={() => onTakeAction(item, session)}>{t.takeAction}</button></li>)}</ul>
            </Accordion>
            <Accordion title={t.speakersHeader}>
                {Object.entries(session.speakers).map(([id, name]) => (
                    <div key={id}>
                        {editingSpeaker?.speakerId === id ?
                            <input type="text" defaultValue={name as string} onBlur={e => onRenameSpeaker(session.id, id, e.target.value)} autoFocus /> :
                            <span onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })}>{name as string} ✏️</span>
                        }
                    </div>
                ))}
            </Accordion>
            <Accordion title={t.transcriptHeader}><div className="transcript-content" dangerouslySetInnerHTML={{ __html: marked.parse(session.results.transcript.replace(/\n/g, '<br/>')) as string }}/></Accordion>
        </div>
    );
};
const Modal = ({ children, onClose, title }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{title}</h2><button onClick={onClose} className="close-btn">&times;</button></div>
            <div className="modal-body">{children}</div>
        </div>
    </div>
);
const ActionModal = ({ data, onClose }) => <Modal onClose={onClose} title="Suggested Action"><pre>{JSON.stringify(data.args, null, 2)}</pre></Modal>;
const AudioDeviceSelector = ({ devices, onDeviceSelected, onClose }) => (
    <Modal onClose={onClose} title={t.selectAudioDeviceTitle}>
        <select onChange={e => onDeviceSelected(e.target.value)} defaultValue=""><option disabled value="">Select Device</option>{devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select>
    </Modal>
);
const FaqModal = ({ onClose }) => <Modal onClose={onClose} title={t.faqTitle}><p>{t.faq[0].a}</p></Modal>;
const ErrorModal = ({ message, onClose }) => <Modal onClose={onClose} title="Error"><p>{message}</p></Modal>;
const LoadingModal = ({ text }) => <div className="modal-overlay"><div className="loading-content"><div className="spinner"/>{text}</div></div>;
const LoadingSpinner = () => <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}><div className="spinner"/></div>;
const BottomNav = ({ activeTab, onTabChange }) => (
    <nav className="bottom-nav">
        <button onClick={() => onTabChange('record')} className={activeTab === 'record' ? 'active' : ''}>🎙️ {t.record}</button>
        <button onClick={() => onTabChange('sessions')} className={activeTab === 'sessions' ? 'active' : ''}>📄 {t.sessions}</button>
    </nav>
);
const Accordion = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`accordion-item ${isOpen ? 'open' : ''}`}>
            <button className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <h3>{title}</h3><span className="accordion-icon">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div className="accordion-content">{children}</div>}
        </div>
    );
};

// --- Global Styles (Full) ---
const globalStyles = \`
    :root {
      --primary-color: #00DAC6; --background-color: #121212; --surface-color: #1E1E1E;
      --text-color: #E0E0E0; --text-muted-color: #A0A0A0; --font-family: 'Poppins', sans-serif;
      --border-radius: 16px; --bottom-nav-height: 70px;
    }
    * { box-sizing: border-box; }
    html, body { font-family: var(--font-family); background-color: var(--background-color); color: var(--text-color); margin: 0; }
    main { padding: 1.5rem 1rem calc(var(--bottom-nav-height) + 1.5rem) 1rem; }
    h1, h2, h3 { font-weight: 600; margin: 0; }
    .page-container { width: 100%; max-width: 800px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-title { color: var(--primary-color); font-size: 2rem; }
    .record-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .timer-display { font-size: 4rem; font-weight: 700; }
    .mic-button { width: 120px; height: 120px; border-radius: 50%; border: none; cursor: pointer; background: var(--primary-color); }
    .mic-button.stop { background: #CF6679; }
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: var(--bottom-nav-height); background: rgba(30,30,30,0.8); backdrop-filter: blur(15px); display: flex; justify-content: space-around; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); }
    .nav-button { background: none; border: none; color: var(--text-muted-color); cursor: pointer; }
    .nav-button.active { color: var(--primary-color); }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--surface-color); padding: 2rem; border-radius: var(--border-radius); max-width: 500px; width: 90%; }
    .spinner { border: 4px solid rgba(255,255,255,0.2); border-radius: 50%; border-top: 4px solid var(--primary-color); width: 50px; height: 50px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    /* ... (add more comprehensive styles as needed) ... */
\`;

createRoot(document.getElementById('root')!).render(<App />);
