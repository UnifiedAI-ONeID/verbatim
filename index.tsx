import React, { useState, useRef, CSSProperties, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';

// --- Type Declarations ---
declare global {
  // Fix: Address TypeScript errors by augmenting the global AIStudio interface
  // with the 'auth' property and ensuring window.aistudio uses this type.
  interface AIStudio {
    auth: {
      getAuthToken: () => Promise<string>;
    };
  }
  interface Window {
    google?: any;
    aistudio?: AIStudio;
  }
}

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type User = { id: string; name: string; email: string; picture?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';
type PostLoginAction = 'record' | 'sessions';

// --- Component Prop Types ---
type AccordionProps = {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
};

type ModalProps = {
  children?: React.ReactNode;
  onClose: () => void;
  title: string;
};

type LoginModalProps = {
    onLoginSuccess: (user: User) => void;
};


// --- Mock Database Service ---
const dbService = {
    getUser: async (): Promise<User | null> => {
        const userJson = localStorage.getItem('verbatim_user');
        if (!userJson) return null;
        try {
            return JSON.parse(userJson);
        } catch (error) {
            console.error('Failed to parse user from localStorage:', error);
            localStorage.removeItem('verbatim_user'); // Clear corrupted data
            return null;
        }
    },
    saveUser: async (user: User): Promise<User> => {
        localStorage.setItem('verbatim_user', JSON.stringify(user));
        return user;
    },
    logout: async (): Promise<void> => {
        localStorage.removeItem('verbatim_user');
    },
    getSessions: async (userId: string): Promise<Session[]> => {
        const sessionsJson = localStorage.getItem(`verbatim_sessions_${userId}`);
        if (!sessionsJson) return [];
        try {
            return JSON.parse(sessionsJson);
        } catch (error) {
            console.error('Failed to parse sessions from localStorage:', error);
            localStorage.removeItem(`verbatim_sessions_${userId}`); // Clear corrupted data
            return [];
        }
    },
    saveSession: async (userId: string, session: Session): Promise<void> => {
        const sessions = await dbService.getSessions(userId);
        const existingIndex = sessions.findIndex(s => s.id === session.id);
        if (existingIndex > -1) {
            sessions[existingIndex] = session;
        } else {
            sessions.unshift(session);
        }
        localStorage.setItem(`verbatim_sessions_${userId}`, JSON.stringify(sessions));
    },
    deleteSession: async (userId: string, sessionId: string): Promise<void> => {
        let sessions = await dbService.getSessions(userId);
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(`verbatim_sessions_${userId}`, JSON.stringify(sessions));
    },
};


// --- i18n Translations ---
const translations = {
    en: {
        title: 'Verbatim',
        subtitle: 'Your intelligent meeting dashboard.',
        welcomeUser: 'Welcome, {name}',
        startRecording: '🎤 New Session',
        stopRecording: '⏹️ Stop',
        analyzing: 'Analyzing...',
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
        analysisPrompt: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, pay special attention to and clearly list any financial figures, budgets, or costs mentioned. Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.',
        actionPrompt: 'You are an intelligent assistant. Based on the full context of a meeting and a specific action item, call the most appropriate tool to help the user complete it. The user\'s language is English. Meeting Title: "{meetingTitle}". Meeting Date: "{meetingDate}". Meeting Summary: "{meetingSummary}". Action Item: "{actionItemText}". Ensure all generated content like email subjects or calendar event titles are concise and relevant. Your primary goal is to provide the correct tool call with accurate arguments.',
    },
};
const t = translations.en; // Simplified for this example

// --- UI Components ---
const Spinner: React.FC = () => (
    <div style={styles.spinnerContainer}>
        <div style={styles.spinner}></div>
    </div>
);

const LoginModal = ({ onLoginSuccess }: LoginModalProps) => {
    const [error, setError] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        setError(null);
        try {
            if (!window.aistudio?.auth?.getAuthToken) {
                console.error('Auth provider not found.');
                setError('Authentication service is not available. Please contact support.');
                return;
            }
            const token = await window.aistudio.auth.getAuthToken();
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user info: ${response.statusText}`);
            }

            const userInfo = await response.json();

            const user: User = {
                id: userInfo.sub,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
            };

            await dbService.saveUser(user);
            onLoginSuccess(user);
        } catch (err) {
            console.error('Error during sign-in:', err);
            setError('An error occurred during sign-in. Please try again.');
        }
    }, [onLoginSuccess]);

    return (
        <div style={styles.authContainer}>
            <div style={styles.authBox}>
                 <div style={styles.authHeader}>
                    <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="v_grad_auth" x1="0.5" y1="0" x2="0.5" y2="1">
                                <stop stopColor="#00D9C8"/>
                                <stop offset="1" stopColor="#00A99D"/>
                            </linearGradient>
                        </defs>
                        <path d="M54 32C54 44.1503 44.1503 54 32 54C19.8497 54 10 44.1503 10 32C10 19.8497 19.8497 10 32 10C38.3995 10 44.2255 12.6106 48.4853 16.8704" stroke="url(#v_grad_auth)" strokeWidth="8" strokeLinecap="round"/>
                        <path d="M22 32L32 42L52 22" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h1 style={styles.authTitle as CSSProperties}>{t.title}</h1>
                 </div>
                 <p style={{ color: '#A0A0A0', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 24px 0' }}>
                    Sign in to continue to your intelligent meeting dashboard.
                </p>
                <div style={styles.signInButtonContainer}>
                    <button onClick={handleLogin} style={styles.signInButton}>
                        Sign In with Google
                    </button>
                </div>
                 { error &&
                    <p style={{color: '#ffc107', fontSize: '0.8rem', marginTop: '16px'}}>
                        {error}
                    </p>
                }
            </div>
        </div>
    );
};

const App: React.FC = () => {
    // Auth and User State
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [postLoginAction, setPostLoginAction] = useState<PostLoginAction | null>(null);

    // App State
    const [activeTab, setActiveTab] = useState<ActiveTab>('sessions');
    const [sessions, setSessions] = useState<Session[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const existingUser = await dbService.getUser();
                if (existingUser) {
                    setUser(existingUser);
                    const userSessions = await dbService.getSessions(existingUser.id);
                    setSessions(userSessions);
                }
            } catch (error) {
                console.error("Failed to load initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const handleLoginSuccess = async (newUser: User) => {
        setUser(newUser);
        setIsLoginModalOpen(false);
        const userSessions = await dbService.getSessions(newUser.id);
        setSessions(userSessions);

        if (postLoginAction === 'record') {
            setActiveTab('record');
        }
        setPostLoginAction(null);
    };

    const handleLogout = async () => {
        await dbService.logout();
        setUser(null);
        setSessions([]);
        setActiveTab('sessions');
    };

    const handleNewSessionClick = () => {
        if (user) {
            setActiveTab('record');
        } else {
            setPostLoginAction('record');
            setIsLoginModalOpen(true);
        }
    };

    if (isLoading) {
        return (
            <div style={{...styles.appContainer, ...styles.centerFlex, height: '100vh'}}>
                <Spinner />
            </div>
        );
    }
    
    return (
        <>
            {isLoginModalOpen && <LoginModal onLoginSuccess={handleLoginSuccess} />}
            <div style={styles.appContainer}>
                {activeTab === 'sessions' && (
                    <>
                        <div style={styles.header}>
                             <div style={styles.headerTitle}>
                                <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs><linearGradient id="v_grad_header" x1="0.5" y1="0" x2="0.5" y2="1"><stop stopColor="#00D9C8"/><stop offset="1" stopColor="#00A99D"/></linearGradient></defs>
                                    <path d="M54 32C54 44.1503 44.1503 54 32 54C19.8497 54 10 44.1503 10 32C10 19.8497 19.8497 10 32 10C38.3995 10 44.2255 12.6106 48.4853 16.8704" stroke="url(#v_grad_header)" strokeWidth="8" strokeLinecap="round"/><path d="M22 32L32 42L52 22" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <h1 style={{margin: 0, fontSize: '1.5rem'}}>{t.title}</h1>
                            </div>
                            {user && (
                                <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
                            )}
                        </div>
                        <div style={styles.content}>
                            {user ? (
                                sessions.length > 0 ? (
                                    <div>
                                        <h2 style={styles.contentTitle}>{t.recentSessions}</h2>
                                        {/* Session list would go here */}
                                        <p style={styles.emptyStateText}>You have {sessions.length} session(s).</p>
                                    </div>
                                ) : (
                                    <div style={styles.emptyState}>
                                        <h2 style={styles.contentTitle}>{t.welcomeUser.replace('{name}', user.name.split(' ')[0])}</h2>
                                        <p style={styles.emptyStateText}>{t.welcomeSubtext}</p>
                                    </div>
                                )
                            ) : (
                                <div style={styles.emptyState}>
                                    <h2 style={styles.contentTitle}>{t.welcomeMessage}</h2>
                                    <p style={styles.emptyStateText}>{t.welcomeSubtext}</p>
                                </div>
                            )}
                        </div>
                        <button onClick={handleNewSessionClick} style={styles.fab} aria-label={t.startRecording}>
                            <span role="img" aria-hidden="true" style={{fontSize: '24px'}}>🎤</span>
                        </button>
                    </>
                )}
                {activeTab === 'record' && (
                     <div style={styles.recordingContainer}>
                        <button onClick={() => setActiveTab('sessions')} style={styles.backButton}>
                            &larr; {t.backToList}
                        </button>
                        <div style={styles.recordingContent}>
                            <h2 style={{fontSize: '1.8rem', marginBottom: '1rem'}}>Recording...</h2>
                            <p style={{color: '#ccc', marginBottom: '2rem'}}>A new session has started.</p>
                             <div style={styles.micPulse}>
                                <span role="img" aria-hidden="true" style={{fontSize: '48px'}}>🎤</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// --- Styles ---
const styles: { [key: string]: CSSProperties } = {
    spinnerContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#121212',
    },
    spinner: {
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        borderTop: '4px solid #fff',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite',
    },
    authContainer: {
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        fontFamily: "'Poppins', sans-serif",
    },
    authBox: {
        backgroundColor: '#1E1E1E',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        width: '100%',
        maxWidth: '400px',
        margin: '20px',
    },
    authHeader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px',
    },
    authTitle: {
        color: '#FFFFFF',
        margin: 0,
        fontSize: '2rem',
        fontWeight: 600,
    },
    signInButtonContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: '24px',
    },
    signInButton: {
        background: 'linear-gradient(45deg, #00D9C8, #00A99D)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '1rem',
        width: '100%',
        boxShadow: '0 2px 8px rgba(0, 217, 200, 0.3)',
        transition: 'transform 0.2s ease',
    },
    appContainer: {
        padding: '20px',
        backgroundColor: '#121212',
        color: 'white',
        fontFamily: "'Poppins', sans-serif",
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    loginButton: {
        background: 'transparent',
        color: '#00D9C8',
        border: '2px solid #00D9C8',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.9rem',
    },
    logoutButton: {
        background: '#333',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
    },
    content: {
        flex: 1,
    },
    contentTitle: {
        margin: '0 0 1rem 0',
    },
    emptyState: {
        textAlign: 'center',
        marginTop: '20vh',
    },
    emptyStateText: {
        color: '#A0A0A0',
        maxWidth: '400px',
        margin: '0 auto',
        lineHeight: 1.6,
    },
    fab: {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(45deg, #00D9C8, #00A99D)',
        color: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 12px rgba(0, 217, 200, 0.4)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
    },
    recordingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        textAlign: 'center',
    },
    recordingContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'transparent',
        color: '#ccc',
        border: 'none',
        fontSize: '1rem',
        cursor: 'pointer',
    },
    micPulse: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'rgba(0, 217, 200, 0.1)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        animation: 'pulse 2s infinite',
    },
    centerFlex: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
};

// Keyframes for spinner animation
const keyframesStyle = document.createElement('style');
keyframesStyle.innerHTML = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 217, 200, 0.4); }
    70% { box-shadow: 0 0 0 20px rgba(0, 217, 200, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 217, 200, 0); }
}
body {
    background-color: #121212;
}
`;
document.head.appendChild(keyframesStyle);


// --- Root Render ---
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}