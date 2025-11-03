import React, { useState, useRef, CSSProperties, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';
import { jwtDecode } from 'jwt-decode';

// --- Type Declarations ---
// FIX: Define the AIStudio interface to resolve type conflicts with global declarations.
interface AIStudio {
  getSecret: (key: string) => Promise<string>;
}

declare global {
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
    googleClientId: string | null;
    onLoginSuccess: (user: User) => void;
};


// --- Mock Database Service ---
const dbService = {
    getUser: async (): Promise<User | null> => {
        const userJson = localStorage.getItem('verbatim_user');
        return userJson ? JSON.parse(userJson) : null;
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
        return sessionsJson ? JSON.parse(sessionsJson) : [];
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

const LoginModal = ({ googleClientId, onLoginSuccess }: LoginModalProps) => {
    const handleLogin = useCallback(async (response: any) => {
        try {
            const decoded: any = jwtDecode(response.credential);
            const user: User = {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email,
                picture: decoded.picture,
            };
            await dbService.saveUser(user);
            onLoginSuccess(user);
        } catch (error) {
            console.error('Error decoding JWT or saving user:', error);
        }
    }, [onLoginSuccess]);

    useEffect(() => {
        if (googleClientId && window.google) {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleLogin,
                });
                const signInButton = document.getElementById('google-signin-button');
                if (signInButton) {
                    window.google.accounts.id.renderButton(
                        signInButton,
                        { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' }
                    );
                }
            } catch (error) {
                console.error("Google Sign-In initialization failed:", error);
            }
        }
    }, [googleClientId, handleLogin]);

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
                <div id="google-signin-button" style={styles.signInButtonContainer}></div>
                 { !googleClientId &&
                    <p style={{color: '#ffc107', fontSize: '0.8rem', marginTop: '16px', lineHeight: 1.5, maxWidth: '300px', margin: '16px auto 0'}}>
                        Google Client ID is not configured. Please ensure the <code>GOOGLE_CLIENT_ID</code> secret is set in your project settings.
                    </p>
                }
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [googleClientId, setGoogleClientId] = useState<string | null>(null);

    useEffect(() => {
        const initializeApp = async () => {
            // First, try to get the client ID from the AI Studio environment
            let clientId: string | null = null;
            if (window.aistudio && typeof window.aistudio.getSecret === 'function') {
                try {
                    clientId = await window.aistudio.getSecret('GOOGLE_CLIENT_ID');
                } catch (e) {
                    console.error('Could not retrieve GOOGLE_CLIENT_ID from aistudio.getSecret:', e);
                }
            }
            
            // Fallback to process.env for local development or other environments
            if (!clientId) {
                clientId = process.env.GOOGLE_CLIENT_ID || null;
            }
            setGoogleClientId(clientId);

            // Then, check for an existing user session
            try {
                const existingUser = await dbService.getUser();
                setUser(existingUser);
            } catch (error) {
                console.error("Failed to get user:", error);
            } finally {
                setIsLoading(false);
            }
        };
        initializeApp();
    }, []);

    const handleLogout = async () => {
        await dbService.logout();
        setUser(null);
        if (window.google) {
            window.google.accounts.id.disableAutoSelect();
        }
    };
    
    if (isLoading) {
        return (
            <div style={{...styles.appContainer, ...styles.centerFlex}}>
                <Spinner />
            </div>
        );
    }

    if (!user) {
        return <LoginModal googleClientId={googleClientId} onLoginSuccess={setUser} />;
    }

    // A placeholder for the main application UI
    return (
        <div style={styles.appContainer}>
            <div style={styles.header}>
                <h1 style={{margin: 0}}>Welcome, {user.name}</h1>
                <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
            </div>
            <div style={{...styles.centerFlex, flexDirection: 'column', height: '80vh'}}>
                <h2>Your sessions will appear here.</h2>
                <p>Click the record button to start a new session.</p>
            </div>
        </div>
    );
};

// --- Styles ---
const styles: { [key: string]: CSSProperties } = {
    spinnerContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
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
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#121212',
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
    appContainer: {
        padding: '20px',
        backgroundColor: '#121212',
        color: 'white',
        fontFamily: "'Poppins', sans-serif",
        minHeight: '100vh',
        boxSizing: 'border-box'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logoutButton: {
        background: '#333',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600
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
body {
    background-color: #121212;
}
code {
    background-color: #333;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
}
`;
document.head.appendChild(keyframesStyle);


// --- Root Render ---
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}