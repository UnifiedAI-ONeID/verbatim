
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { marked } from 'marked';

// --- Firebase and App Initialization ---
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDj57lfDQ7CXmu7wjuXhNQHL7ReURGs6pA",
  authDomain: "verbatim-pa-50946397-928b2.firebaseapp.com",
  projectId: "verbatim-pa-50946397-928b2",
  storageBucket: "verbatim-pa-50946397-928b2.firebasestorage.app",
  messagingSenderId: "419412918935",
  appId: "1:419412918935:web:6b3105cde2b51b24b5dfd2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const auth = getAuth(firebaseApp);
const functions = getFunctions(firebaseApp);


// --- React Components ---

const App: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState(localStorage.getItem('verbatim_theme') || 'system');
    const [language, setLanguage] = useState(localStorage.getItem('verbatim_language') || 'en');

    const translations = useMemo(() => ({
        'en': {
            title: 'Verbatim',
            subtitle: 'Your intelligent meeting dashboard.',
            welcomeUser: 'Welcome, {name}',
            startRecording: '🎤 New Session',
            stopRecording: '⏹️ Stop',
            analyzing: 'Analyzing...',
            processing: 'Processing...',
            micPermissionError: 'Could not start recording. Please grant microphone permissions.',
            processingError: 'Failed to process audio. This could be due to a poor network connection, a recording that is too short, or silent audio. Please try again.',
            offlineError: 'Analysis requires an internet connection. Please connect and try again.',
            recordingTooShortError: 'Recording is too short to be analyzed. Please record for at least 2 seconds.',
            transcriptHeader: '📋 Transcript',
            summaryHeader: '✨ Core Summary',
            actionItemsHeader: '📌 Action Items',
            noTranscript: 'Could not retrieve transcript.',
            noSummary: 'Could not retrieve summary.',
            noActionItems: 'No action items were identified.',
            takeAction: 'Take Action ✨',
            noActionDetermined: 'Could not determine a specific action for this item. Please handle it manually.',
            deleteSession: 'Delete Session',
            confirmDelete: 'Are you sure you want to permanently delete this session and its recording? This action cannot be undone.',
            delete: 'Delete',
            cancel: 'Cancel',
            tapToRecord: 'Tap to start recording',
            signIn: 'Sign In',
            signOut: 'Sign Out',
            signInToRecord: 'Sign in to start recording',
            signInToView: 'Sign in to view sessions',
            theme: 'Theme',
            language: 'Language',
            signInError: 'Google Sign-In failed. Please try again.',
            signInPopupBlockedError: 'Sign-in pop-up was blocked by the browser. Please allow pop-ups for this site.',
        },
        'es': {
            title: 'Verbatim',
            subtitle: 'Tu panel de reuniones inteligente.',
            welcomeUser: 'Bienvenido, {name}',
            startRecording: '🎤 Nueva Sesión',
            stopRecording: '⏹️ Detener',
            analyzing: 'Analizando...',
            processing: 'Procesando...',
            micPermissionError: 'No se pudo iniciar la grabación. Por favor, concede permisos de micrófono.',
            processingError: 'Error al procesar el audio. Esto podría deberse a una mala conexión de red, una grabación demasiado corta o audio silencioso. Por favor, inténtalo de nuevo.',
            offlineError: 'El análisis requiere una conexión a internet. Por favor, conéctate y vuelve a intentarlo.',
            recordingTooShortError: 'La grabación es demasiado corta para ser analizada. Por favor, graba durante al menos 2 segundos.',
            transcriptHeader: '📋 Transcripción',
            summaryHeader: '✨ Resumen Principal',
            actionItemsHeader: '📌 Puntos de Acción',
            noTranscript: 'No se pudo recuperar la transcripción.',
            noSummary: 'No se pudo recuperar el resumen.',
            noActionItems: 'No se identificaron puntos de acción.',
            takeAction: 'Tomar Acción ✨',
            noActionDetermined: 'No se pudo determinar una acción específica para este ítem. Por favor, gestiónalo manualmente.',
            deleteSession: 'Eliminar Sesión',
            confirmDelete: '¿Estás seguro de que quieres eliminar permanentemente esta sesión y su grabación? Esta acción no se puede deshacer.',
            delete: 'Eliminar',
            cancel: 'Cancelar',
            tapToRecord: 'Toca para empezar a grabar',
            signIn: 'Iniciar Sesión',
            signOut: 'Cerrar Sesión',
            signInToRecord: 'Inicia sesión para empezar a grabar',
            signInToView: 'Inicia sesión para ver las sesiones',
            theme: 'Tema',
            language: 'Idioma',
            signInError: 'El inicio de sesión con Google falló. Por favor, inténtalo de nuevo.',
            signInPopupBlockedError: 'La ventana emergente de inicio de sesión fue bloqueada por el navegador. Por favor, permite ventanas emergentes para este sitio.',
        },
        'fr': {
            title: 'Verbatim',
            subtitle: 'Votre tableau de bord de réunion intelligent.',
            welcomeUser: 'Bienvenue, {name}',
            startRecording: '🎤 Nouvelle Session',
            stopRecording: '⏹️ Arrêter',
            analyzing: 'Analyse en cours...',
            processing: 'Traitement en cours...',
            micPermissionError: 'Impossible de démarrer l\'enregistrement. Veuillez accorder les autorisations de microphone.',
            processingError: 'Échec du traitement audio. Cela peut être dû à une mauvaise connexion réseau, un enregistrement trop court ou un audio silencieux. Veuillez réessayer.',
            offlineError: 'L\'analyse nécessite une connexion Internet. Veuillez vous connecter et réessayer.',
            recordingTooShortError: 'L\'enregistrement est trop court pour être analysé. Veuillez enregistrer pendant au moins 2 secondes.',
            transcriptHeader: '📋 Transcription',
            summaryHeader: '✨ Résumé Principal',
            actionItemsHeader: '📌 Actions Requises',
            noTranscript: 'Impossible de récupérer la transcription.',
            noSummary: 'Impossible de récupérer le résumé.',
            noActionItems: 'Aucune action requise n\'a été identifiée.',
            takeAction: 'Agir ✨',
            noActionDetermined: 'Impossible de déterminer une action spécifique pour cet élément. Veuillez le traiter manuellement.',
            deleteSession: 'Supprimer la Session',
            confirmDelete: 'Êtes-vous sûr de vouloir supprimer définitivement cette session et son enregistrement ? Cette action est irréversible.',
            delete: 'Supprimer',
            cancel: 'Annuler',
            tapToRecord: 'Appuyez pour commencer à enregistrer',
            signIn: 'Se connecter',
            signOut: 'Se déconnecter',
            signInToRecord: 'Connectez-vous pour commencer à enregistrer',
            signInToView: 'Connectez-vous pour voir les sessions',
            theme: 'Thème',
            language: 'Langue',
            signInError: 'La connexion avec Google a échoué. Veuillez réessayer.',
            signInPopupBlockedError: 'La fenêtre de connexion a été bloquée par le navigateur. Veuillez autoriser les fenêtres contextuelles pour ce site.',
        },
        'zh-CN': {
            title: 'Verbatim',
            subtitle: '您的智能会议仪表板。',
            welcomeUser: '欢迎，{name}',
            startRecording: '🎤 新建会话',
            stopRecording: '⏹️ 停止',
            analyzing: '分析中...',
            processing: '处理中...',
            micPermissionError: '无法开始录音。请授予麦克风权限。',
            processingError: '处理音频失败。这可能是由于网络连接不佳、录音时间过短或音频无声。请重试。',
            offlineError: '分析需要网络连接。请连接后重试。',
            recordingTooShortError: '录音时间太短，无法分析。请至少录制2秒。',
            transcriptHeader: '📋 文本记录',
            summaryHeader: '✨ 核心摘要',
            actionItemsHeader: '📌 行动项',
            noTranscript: '无法检索文本记录。',
            noSummary: '无法检索摘要。',
            noActionItems: '未识别到任何行动项。',
            takeAction: '执行操作 ✨',
            noActionDetermined: '无法为此项目确定具体操作。请手动处理。',
            deleteSession: '删除会话',
            confirmDelete: '您确定要永久删除此会话及其录音吗？此操作无法撤销。',
            delete: '删除',
            cancel: '取消',
            tapToRecord: '点击开始录音',
            signIn: '登录',
            signOut: '登出',
            signInToRecord: '登录以开始录音',
            signInToView: '登录以查看会话',
            theme: '主题',
            language: '语言',
            signInError: 'Google 登录失败，请重试。',
            signInPopupBlockedError: '登录弹出窗口被浏览器阻止。请允许此站点的弹出窗口。',
        },
         'zh-TW': {
            title: 'Verbatim',
            subtitle: '您的智慧會議儀表板。',
            welcomeUser: '歡迎，{name}',
            startRecording: '🎤 新增會話',
            stopRecording: '⏹️ 停止',
            analyzing: '分析中...',
            processing: '處理中...',
            micPermissionError: '無法開始錄音。請授予麥克風權限。',
            processingError: '處理音訊失敗。這可能是由於網路連線不佳、錄音時間過短或音訊無聲。請重試。',
            offlineError: '分析需要網路連線。請連線後重試。',
            recordingTooShortError: '錄音時間太短，無法分析。請至少錄製2秒。',
            transcriptHeader: '📋 文字記錄',
            summaryHeader: '✨ 核心摘要',
            actionItemsHeader: '📌 行動項',
            noTranscript: '無法擷取文字記錄。',
            noSummary: '無法擷取摘要。',
            noActionItems: '未識別出任何行動項。',
            takeAction: '執行操作 ✨',
            noActionDetermined: '無法為此項目確定具體操作。請手動處理。',
            deleteSession: '刪除工作階段',
            confirmDelete: '您確定要永久刪除此工作階段及其錄音嗎？此動作無法復原。',
            delete: '刪除',
            cancel: '取消',
            tapToRecord: '輕觸以開始錄音',
            signIn: '登入',
            signOut: '登出',
            signInToRecord: '登入以開始錄音',
            signInToView: '登入以檢視工作階段',
            theme: '主題',
            language: '語言',
            signInError: 'Google 登入失敗，請重試。',
            signInPopupBlockedError: '登入彈出視窗已被瀏覽器封鎖。請允許此網站的彈出視窗。',
        },
    }), [language]);
    
    const t = useMemo(() => translations[language] || translations['en'], [language, translations]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(newUser => {
            setUser(newUser);
            setIsLoading(false);
            if (newUser) {
                const q = collection(db, `users/${newUser.uid}/sessions`);
                const sessionUnsubscribe = onSnapshot(q, snapshot => {
                    const sessionList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setSessions(sessionList);
                });
                return () => sessionUnsubscribe();
            } else {
                setSessions([]);
                setSelectedSession(null);
                setSessionData(null);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let unsubscribe: Function | null = null;
        if (selectedSession && user) {
            const docRef = doc(db, `users/${user.uid}/sessions`, selectedSession);
            unsubscribe = onSnapshot(docRef, (doc) => {
                setSessionData(doc.data());
            });
        } else {
            setSessionData(null);
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [selectedSession, user]);
    
    useEffect(() => {
        const root = document.documentElement;
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const newTheme = theme === 'system' ? systemTheme : theme;
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('verbatim_theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('verbatim_language', language);
        document.documentElement.lang = language;
    }, [language]);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        auth.languageCode = language;
        try {
            await signInWithPopup(auth, provider);
            setError(null);
        } catch (error: any) {
            console.error("Google Sign-In Error: ", error);
            if (error.code === 'auth/popup-blocked') {
                setError(t.signInPopupBlockedError);
            } else {
                setError(t.signInError);
            }
        }
    };

    const handleSignOut = async () => {
        await firebaseSignOut(auth);
    };

    const handleStartRecording = async () => {
        setError(null);
        if (!navigator.onLine) {
            setError(t.offlineError);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newRecorder = new MediaRecorder(stream);
            setRecorder(newRecorder);
            newRecorder.start();
            setIsRecording(true);
            audioChunksRef.current = [];

            newRecorder.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            const newSessionRef = await addDoc(collection(db, `users/${user.uid}/sessions`), {
                createdAt: serverTimestamp(),
                status: 'recording'
            });
            setCurrentSessionId(newSessionRef.id);
            setSelectedSession(newSessionRef.id);

        } catch (err) {
            console.error("Mic permission error:", err);
            setError(t.micPermissionError);
        }
    };

    const handleStopRecording = () => {
        if (recorder) {
            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                if (audioBlob.size < 2000) { 
                    setError(t.recordingTooShortError);
                     if (currentSessionId) {
                         const sessionDocRef = doc(db, `users/${user.uid}/sessions`, currentSessionId);
                         await deleteDoc(sessionDocRef);
                     }
                    setIsRecording(false);
                    setCurrentSessionId(null);
                    return;
                }

                if (currentSessionId) {
                    const sessionDocRef = doc(db, `users/${user.uid}/sessions`, currentSessionId);
                    await updateDoc(sessionDocRef, { status: 'processing' });
                    
                    const audioRef = storageRef(storage, `recordings/${user.uid}/${currentSessionId}.webm`);
                    await uploadBytes(audioRef, audioBlob);
                    
                    try {
                        const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                        await analyzeAudio({ sessionId: currentSessionId });
                    } catch (error) { 
                        console.error("Error calling analyzeAudio function:", error);
                        await updateDoc(sessionDocRef, { status: 'error', error: t.processingError });
                        setError(t.processingError);
                    }
                }
                recorder.stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
                setRecorder(null);
            };
            recorder.stop();
        }
    };

    const handleTakeAction = async (prompt: string) => {
        try {
            const takeActionFn = httpsCallable(functions, 'takeAction');
            const result = await takeActionFn({ prompt });
            const { type, args } = (result.data as any) || {};
            
            if (type && args) {
                alert(`Action: ${type}\nArgs: ${JSON.stringify(args, null, 2)}`);
            } else {
                 alert(t.noActionDetermined);
            }
        } catch (error) {
            console.error('Error taking action:', error);
            alert('An error occurred while trying to take the action.');
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (window.confirm(t.confirmDelete)) {
            try {
                // In a production app, you should use a Cloud Function to ensure
                // that users can only delete their own data and to delete associated
                // files from Cloud Storage.
                // const deleteSessionFn = httpsCallable(functions, 'deleteSession');
                // await deleteSessionFn({ sessionId });

                const sessionDocRef = doc(db, `users/${user.uid}/sessions`, sessionId);
                await deleteDoc(sessionDocRef);
                 
                 if (selectedSession === sessionId) {
                     setSelectedSession(null);
                 }
                 
            } catch (error) {
                console.error('Error deleting session:', error);
                alert('Error deleting session.');
            }
        }
    };
    
    if (isLoading) {
        return <div className="loading-screen"></div>;
    }

    return (
        <div className="app-container">
            <Sidebar 
                user={user} 
                sessions={sessions} 
                selectedSession={selectedSession} 
                onSelectSession={setSelectedSession} 
                onSignOut={handleSignOut} 
                onSignIn={signInWithGoogle}
                isRecording={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                t={t}
            />
            <MainContent 
                sessionData={sessionData} 
                selectedSession={selectedSession}
                user={user}
                onSignIn={signInWithGoogle}
                onTakeAction={handleTakeAction}
                onDeleteSession={handleDeleteSession}
                theme={theme}
                setTheme={setTheme}
                language={language}
                setLanguage={setLanguage}
                error={error}
                setError={setError}
                t={t}
            />
        </div>
    );
};


const Sidebar: React.FC<any> = ({ user, sessions, selectedSession, onSelectSession, onSignOut, onSignIn, isRecording, onStartRecording, onStopRecording, t }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h1>{t.title}</h1>
                <p className="subtitle">{t.subtitle}</p>
            </div>
            {user ? (
                <>
                    <div className="user-info">
                        <span>{t.welcomeUser.replace('{name}', user.displayName || 'User')}</span>
                        <button onClick={onSignOut} className="signout-button">{t.signOut}</button>
                    </div>
                    <button 
                        onClick={isRecording ? onStopRecording : onStartRecording} 
                        className={`record-button ${isRecording ? 'recording' : ''}`}>
                        {isRecording ? t.stopRecording : t.startRecording}
                    </button>
                    <div className="session-list">
                        {sessions.map((session: any) => (
                            <div 
                                key={session.id} 
                                className={`session-item ${selectedSession === session.id ? 'selected' : ''}`}
                                onClick={() => onSelectSession(session.id)}>
                                {new Date(session.createdAt?.toDate()).toLocaleString()}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="sidebar-signed-out">
                     <button onClick={onSignIn} className="signin-button-main">{t.signIn}</button>
                </div>
            )}
        </div>
    );
};

const MainContent: React.FC<any> = ({ sessionData, selectedSession, user, onSignIn, onTakeAction, onDeleteSession, theme, setTheme, language, setLanguage, error, setError, t }) => {
    if (!user) {
        return (
            <div className="main-content-signed-out">
                 <div className="logo-container">
                    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100" height="100" rx="20" fill="var(--accent-primary)"/>
                        <path d="M30 65V35H45V65H30Z" fill="var(--accent-primary-text)"/>
                        <path d="M55 65V35H70V65H55Z" fill="var(--accent-primary-text)"/>
                    </svg>
                </div>
                <h2>{t.title}</h2>
                <p>{t.subtitle}</p>
                <button onClick={onSignIn} className="signin-button-main">{t.signIn}</button>
                 {error && <p className="error-message auth-error">{error}</p>}
                 <Settings theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} t={t} />
            </div>
        );
    }
    
    if (!selectedSession) {
        return (
             <div className="main-content-empty">
                 <div className="logo-container">
                     <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100" height="100" rx="20" fill="var(--accent-primary)"/>
                        <path d="M30 65V35H45V65H30Z" fill="var(--accent-primary-text)"/>
                        <path d="M55 65V35H70V65H55Z" fill="var(--accent-primary-text)"/>
                    </svg>
                </div>
                <h2>{t.welcomeUser.replace('{name}', user.displayName || 'User')}</h2>
                <p>{t.tapToRecord}</p>
                <Settings theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} t={t} />
            </div>
        );
    }

    if (!sessionData) {
        return <div className="loading-screen"></div>;
    }

    return (
        <div className="main-content">
             {sessionData.status === 'error' && <p className="error-message">{sessionData.error || t.processingError}</p>}
             {sessionData.status === 'recording' && <p>{t.stopRecording}...</p>}
             {sessionData.status === 'processing' && <p>{t.processing}...</p>}
             {sessionData.status === 'analyzing' && <p>{t.analyzing}...</p>}

            {(sessionData.status === 'completed' || sessionData.results) && (
                <>
                    <ResultsDisplay sessionData={sessionData} onTakeAction={onTakeAction} t={t} />
                    <div className="session-actions">
                        <button onClick={() => onDeleteSession(selectedSession)} className="delete-button">{t.deleteSession}</button>
                    </div>
                </>
            )}
            <Settings theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} t={t} />
        </div>
    );
};

const ResultsDisplay: React.FC<any> = ({ sessionData, onTakeAction, t }) => {
    const { summary, actionItems, transcript } = sessionData.results || {};

    const createMarkup = (htmlContent: string) => {
        return { __html: htmlContent };
    };

    return (
        <div className="results-container">
            <div className="result-column summary-column">
                <h2>{t.summaryHeader}</h2>
                {summary ? (
                    <div className="prose" dangerouslySetInnerHTML={createMarkup(marked.parse(summary))} />
                ) : <p>{t.noSummary}</p>}
            </div>
            <div className="result-column">
                <h2>{t.actionItemsHeader}</h2>
                {actionItems && actionItems.length > 0 ? (
                    <ul className="action-items-list">
                        {actionItems.map((item: string, index: number) => (
                            <li key={index} className="action-item">
                                <span>{item}</span>
                                <button onClick={() => onTakeAction(item)} className="action-button">{t.takeAction}</button>
                            </li>
                        ))}
                    </ul>
                ) : <p>{t.noActionItems}</p>}
            </div>
            <div className="result-column transcript-column">
                <h2>{t.transcriptHeader}</h2>
                {transcript ? (
                    <div className="transcript" dangerouslySetInnerHTML={createMarkup(marked.parse(transcript))} />
                ) : <p>{t.noTranscript}</p>}
            </div>
        </div>
    );
};

const Settings: React.FC<any> = ({ theme, setTheme, language, setLanguage, t }) => {
    return (
        <div className="settings-panel">
             <div className="settings-group">
                <label htmlFor="theme-select">{t.theme}</label>
                <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
             <div className="settings-group">
                <label htmlFor="language-select">{t.language}</label>
                <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="zh-CN">中文 (简体)</option>
                    <option value="zh-TW">中文 (繁體)</option>
                </select>
            </div>
        </div>
    );
};


const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
