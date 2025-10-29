
import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { marked } from 'marked';

// --- i18n Translations (assuming they are complete as in public/index.tsx) ---
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
        noActionItems: 'No action items were identified.',
        takeAction: 'Take Action ✨',
        noActionDetermined: 'Could not determine a specific action for this item. You can handle it manually.',
        createCalendarEvent: 'Create Google Calendar Event',
        addToCalendar: 'Add to Calendar',
        titleLabel: 'Title:',
        descriptionLabel: 'Description:',
        dateLabel: 'Date:',
        timeLabel: 'Time:',
        openInGoogleCalendar: 'Open in Google Calendar',
        openInOutlookCalendar: 'Open in Outlook Calendar',
        draftEmail: 'Draft Email',
        toLabel: 'To:',
        subjectLabel: 'Subject:',
        bodyLabel: 'Body:',
        openInEmailApp: 'Open in Email App',
        draftInvoiceEmail: 'Draft Invoice Email',
        recipientNameLabel: 'Recipient Name:',
        amountLabel: 'Amount:',
        invoiceEmailBody: 'Hello {recipientName},
\nThis is an invoice for the following item:
- {itemDescription}
\nAmount Due: {currencySymbol}{amount}
\nPlease let me know if you have any questions.
\nBest,
{userName}',
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
        retryAnalysis: 'Retry Analysis',
        retryFailed: 'Failed to start retry.',
        errorDetails: 'Error Details',
        analysisPrompt: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, pay special attention to and clearly list any financial figures, budgets, or costs mentioned. Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.',
        actionPrompt: 'You are an intelligent assistant. Based on the full context of a meeting and a specific action item, call the most appropriate tool to help the user complete it. The user\'s language is English. Meeting Title: "{meetingTitle}". Meeting Date: "{meetingDate}". Meeting Summary: "{meetingSummary}". Action Item: "{actionItemText}". Ensure all generated content like email subjects or event descriptions are relevant to the meeting context.',
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
        signIn: 'Sign In',
        signOut: 'Sign Out',
        signInToRecord: 'Sign in to start recording',
        signInToView: 'Sign in to view sessions',
        theme: 'Theme',
        language: 'Language',
        signInError: 'Failed to sign in with Google. Please try again.',
        signInPopupBlockedError: 'Sign-in popup was blocked by the browser. Please allow popups for this site.',
    },
    es: { /* Spanish Translations */ },
    'zh-CN': { /* Simplified Chinese Translations */ },
    'zh-TW': { /* Traditional Chinese Translations */ }
};

// --- Firebase Initialization ---
// The configuration is loaded dynamically from /__/firebase/init.js
const firebaseApp = initializeApp({}); 
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code === 'unimplemented') {
        console.warn("Firestore persistence not supported in this browser.");
    }
});

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Theme = 'light' | 'dark';
type Session = { id: string; metadata: any; results: any; speakers: Record<string, string>; status: 'processing' | 'completed' | 'error' | 'recording'; error?: string; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };

// --- Contexts ---
const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });
const LanguageContext = createContext({ lang: 'en', setLang: (lang: Language) => {}, t: translations.en });
const AuthContext = createContext<{ user: User | null }>({ user: null });

// --- Providers ---
const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const storedTheme = localStorage.getItem('verbatim_theme');
        return (storedTheme === 'light' || storedTheme === 'dark') ? storedTheme : 'dark';
    });
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('verbatim_theme', theme);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

const LanguageProvider = ({ children }) => {
    const [lang, setLang] = useState<Language>('en'); // Default language
    useEffect(() => {
        const storedLang = localStorage.getItem('verbatim_language') as Language;
        if (storedLang && translations[storedLang]) {
            setLang(storedLang);
        } else {
            const browserLang = navigator.language.split('-')[0];
            if (browserLang === 'es' || browserLang === 'zh') {
                setLang(browserLang);
            }
        }
    }, []);
    const setLanguage = (newLang: Language) => {
        localStorage.setItem('verbatim_language', newLang);
        setLang(newLang);
    };
    return <LanguageContext.Provider value={{ lang, setLang: setLanguage, t: translations[lang] }}>{children}</LanguageContext.Provider>;
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (isLoading) {
        return <div className="loading-screen">Loading...</div>;
    }

    return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
};


// --- Main App Component ---
const App = () => {
    const { user } = useContext(AuthContext);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const { t } = useContext(LanguageContext);

    useEffect(() => {
        if (!user) {
            setSessions([]);
            return;
        }
        const q = collection(db, 'users', user.uid, 'sessions');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(sessionsData);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSelectSession = (id: string) => {
        setSelectedSessionId(id);
    };
    
    const handleBack = () => {
        setSelectedSessionId(null);
    }

    const selectedSession = useMemo(() => {
        return sessions.find(s => s.id === selectedSessionId) || null;
    }, [sessions, selectedSessionId]);

    return (
        <div className="app-container">
            <Header />
            <main className="main-content">
                {user ? (
                    selectedSession ? (
                        <SessionDetailView session={selectedSession} onBack={handleBack} />
                    ) : (
                        <SessionListView sessions={sessions} onSelectSession={handleSelectSession} />
                    )
                ) : (
                    <LoginView />
                )}
            </main>
        </div>
    );
};

// --- Sub-Components ---

const Header = () => {
    const { user } = useContext(AuthContext);
    const { t, lang, setLang } = useContext(LanguageContext);
    const { theme, toggleTheme } = useContext(ThemeContext);

    const handleSignIn = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            console.error("Sign in error", error);
            alert(t.signInError);
        });
    };

    return (
        <header className="header">
            <div className="logo">{t.title}</div>
            <div className="header-controls">
                <select value={lang} onChange={e => setLang(e.target.value as Language)}>
                    <option value="en">EN</option>
                    <option value="es">ES</option>
                    <option value="zh-CN">简体</option>
                    <option value="zh-TW">繁體</option>
                </select>
                <button onClick={toggleTheme}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? (
                    <button onClick={() => firebaseSignOut(auth)}>{t.signOut}</button>
                ) : (
                    <button onClick={handleSignIn}>{t.signIn}</button>
                )}
            </div>
        </header>
    );
};

const LoginView = () => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="login-view">
            <h2>{t.welcomeMessage}</h2>
            <p>{t.signInToView}</p>
        </div>
    )
}

const SessionListView = ({ sessions, onSelectSession }) => {
    const { t } = useContext(LanguageContext);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const { user } = useContext(AuthContext);

    const handleStartRecording = async () => {
        if (!user) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });

                // Create a session document in Firestore
                const sessionRef = await addDoc(collection(db, 'users', user.uid, 'sessions'), {
                    status: 'processing',
                    createdAt: serverTimestamp(),
                    metadata: { title: `Recording ${new Date().toLocaleString()}` }
                });

                // Upload audio to Cloud Storage
                const audioRef = storageRef(storage, `recordings/${user.uid}/${sessionRef.id}.webm`);
                await uploadBytes(audioRef, blob);
                
                // Trigger analysis via Cloud Function
                const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                await analyzeAudio({ sessionId: sessionRef.id, prompt: t.analysisPrompt });
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Failed to start recording", error);
            alert(t.micPermissionError);
        }
    };

    const handleStopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };
    
    return (
        <div className="session-list-view">
            <div className="record-section">
                <button onClick={isRecording ? handleStopRecording : handleStartRecording} className={`record-button ${isRecording ? 'recording' : ''}`}>
                    {isRecording ? t.stopRecording : t.startRecording}
                </button>
            </div>
            <h2>{t.recentSessions}</h2>
            <ul className="session-list">
                {sessions.map(session => (
                    <li key={session.id} onClick={() => onSelectSession(session.id)} className="session-item">
                        <span>{session.metadata.title}</span>
                        <span className={`status-chip status-${session.status}`}>{t[session.status] || session.status}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const SessionDetailView = ({ session, onBack }) => {
    const { t } = useContext(LanguageContext);
    const [actionModal, setActionModal] = useState<ActionModalData | null>(null);
    
    if (!session) {
        return <div className="loading-screen"></div>;
    }

    const handleTakeAction = async (item: string) => {
        try {
            const takeAction = httpsCallable(functions, 'takeAction');
            const prompt = t.actionPrompt
                .replace('{meetingTitle}', session.metadata.title)
                .replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString())
                .replace('{meetingSummary}', session.results.summary)
                .replace('{actionItemText}', item);

            const response = await takeAction({ prompt });
            const result = response.data as any;
            if (result) {
                setActionModal({ type: result.type, args: result.args, sourceItem: item });
            } else {
                setActionModal({ type: 'unknown', sourceItem: item });
            }
        } catch (err) {
            console.error("Action error:", err);
            setActionModal({ type: 'error' });
        }
    };
    
    const handleDelete = async () => {
        if (window.confirm(t.deleteConfirmation)) {
            await deleteDoc(doc(db, 'users', session.uid, 'sessions', session.id));
            await deleteObject(storageRef(storage, `recordings/${session.uid}/${session.id}.webm`));
            onBack();
        }
    }

    return (
        <div className="session-detail-view">
            <button onClick={onBack} className="back-button">{t.backToList}</button>
            <div className="detail-header">
                <h2>{session.metadata.title}</h2>
                <button onClick={handleDelete} className="delete-button">{t.deleteSession}</button>
            </div>
            
            {session.status === 'error' && <p className="error-message">{session.error || t.processingError}</p>}
            {session.status === 'recording' && <p>{t.stopRecording}...</p>}
            {session.status === 'processing' && <p>{t.processing}...</p>}
            {session.status === 'analyzing' && <p>{t.analyzing}...</p>}
            
            {session.status === 'completed' && (
                <>
                    <div className="summary-section">
                        <h3>{t.summaryHeader}</h3>
                        <div dangerouslySetInnerHTML={{ __html: marked(session.results.summary) }}></div>
                    </div>
                    <div className="action-items-section">
                        <h3>{t.actionItemsHeader}</h3>
                        <ul>
                            {session.results.actionItems.map((item, index) => (
                                <li key={index}>
                                    {item}
                                    <button onClick={() => handleTakeAction(item)}>{t.takeAction}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="transcript-section">
                        <h3>{t.transcriptHeader}</h3>
                        <div dangerouslySetInnerHTML={{ __html: marked(session.results.transcript) }}></div>
                    </div>
                </>
            )}
             {actionModal && <ActionModal data={actionModal} onClose={() => setActionModal(null)} />}
        </div>
    );
};

const ActionModal = ({ data, onClose }) => {
    const { t } = useContext(LanguageContext);
    const { type, args, sourceItem } = data;

    // A simple modal display. In a real app, you'd use a proper modal library.
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="close-button">&times;</button>
                <h3>{t[type] || t.takeAction}</h3>
                <p><em>"{sourceItem}"</em></p>
                {args && <pre>{JSON.stringify(args, null, 2)}</pre>}
                {type === 'error' && <p>{t.actionError}</p>}
                {type === 'unknown' && <p>{t.noActionDetermined}</p>}
            </div>
        </div>
    );
}

// --- Root Render ---
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    </React.StrictMode>
);

