console.log('[components.tsx] Module start.');
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, doc, setDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { marked } from 'marked';
import { Session, ActionModalData, ModalProps, AccordionProps, EditingSpeaker } from './types.ts';
import { useLocalization, useTheme } from './contexts.tsx';
import { styles } from './styles.ts';
import { auth, db, storage, functions, ai } from './services.ts';
import { firebaseConfig, tools } from './config.ts';
import { useKeepAwake } from './hooks.ts';

// --- Error Boundary ---
// FIX: Refactored to use a named interface for props to solve a type inference issue where `this.props` was not recognized.
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error in React component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '20px', margin: 'auto', textAlign: 'center', color: 'var(--danger)' }}>
          <h2>Something went wrong.</h2>
          <p>Please try refreshing the page. If the problem persists, the error has been logged to the console.</p>
          <button style={styles.primaryButton} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Loading Component ---
export const LoadingSpinner = ({ fullScreen = false }: { fullScreen?: boolean }) => {
    const spinnerStyle: React.CSSProperties = {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'conic-gradient(#00DAC6, #f9c74f, #f94144, #90be6d, #00DAC6)',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
        animation: 'spin 1s linear infinite',
    };

    if (fullScreen) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={spinnerStyle}></div>
            </div>
        );
    }
    return <div style={spinnerStyle}></div>;
};

// --- Sub-Components ---
export const Header = ({ user, onSignIn, onLogoClick }: { user: User | null; onSignIn: () => void; onLogoClick: () => void; }) => {
    const { t, lang, setLang } = useLocalization();
    const { theme, toggleTheme } = useTheme();
    const handleSignOut = async () => {
        try {
            await firebaseSignOut(auth);
            console.log("User signed out successfully.");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };
    return (
        <header style={styles.header}>
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo">
                <img src="/icon.svg" alt="" style={styles.logoIcon} />
                <span style={styles.logoText}>{t.title}</span>
            </div>
            <div style={styles.headerControls}>
                 <select value={lang} onChange={e => setLang(e.target.value as any)} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={toggleTheme} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? <button onClick={handleSignOut} style={styles.secondaryButton}>{t.signOut}</button> : <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>}
            </div>
        </header>
    );
};

export const RecordView = ({ recordingStatus, recordingTime, error, user, onStopRecording, onStartRecordingClick, keepAwake, setKeepAwake, onTogglePip }: any) => {
    const { t } = useLocalization();
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    
    const isRecording = recordingStatus === 'recording';
    const isPreparing = recordingStatus === 'preparing';
    const isSaving = recordingStatus === 'saving';
    const isDisabled = isPreparing || isSaving || !user;

    const getButtonContent = () => {
        if (isPreparing || isSaving) return <LoadingSpinner />;
        return isRecording ? '⏹️' : '🎤';
    };

    const getButtonText = () => {
        if (isSaving) return t.processing;
        if (isPreparing) return t.preparing;
        if (isRecording) return formatTime(recordingTime);
        return user ? t.tapToRecord : t.signInToRecord;
    };

    return (
        <div style={styles.recordView}>
            <div style={styles.recordButtonContainer}>
                <button 
                    style={{ 
                        ...styles.recordButton, 
                        ...(isRecording ? styles.recordButtonRecording : {}),
                        ...(isDisabled && !isRecording ? styles.recordButtonDisabled : {})
                    }} 
                    onClick={isRecording ? onStopRecording : onStartRecordingClick} 
                    disabled={isDisabled && !isRecording}
                    aria-label={isRecording ? t.stopRecording : t.startRecording}
                >
                    {getButtonContent()}
                </button>
                <p style={styles.recordButtonText}>{getButtonText()}</p>
                 <div style={styles.statusContainer} aria-live="polite">
                    {error && <p style={styles.errorText}>{error}</p>}
                 </div>
            </div>
            <footer style={styles.recordFooter}>
                 <label style={styles.toggleSwitchLabel}><span>{t.keepAwake}</span><div style={styles.toggleSwitch}><input type="checkbox" checked={keepAwake} onChange={() => setKeepAwake(!keepAwake)} /><span className="slider"></span></div></label>
                 {isRecording && <button onClick={onTogglePip} style={styles.secondaryButton}>{t.toggleMiniView}</button>}
            </footer>
        </div>
    );
};

export const SessionsListView = ({ sessions, onSelectSession, searchQuery, setSearchQuery, isLoading }: { sessions: Session[], onSelectSession: (s: Session) => void, searchQuery: string, setSearchQuery: (q: string) => void, isLoading: boolean }) => {
    const { t } = useLocalization();
    const filtered = sessions.filter((s: Session) => [s.metadata.title, s.results?.summary, s.results?.transcript].some(text => text?.toLowerCase().includes(searchQuery.toLowerCase())));
    return (
        <div style={styles.sessionsView}>
            <div style={styles.sessionsHeader}>
                <h2 style={styles.sessionsHeaderTitle}>{t.recentSessions}</h2>
                <input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={styles.searchInput} />
            </div>
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}>
                    <LoadingSpinner />
                </div>
            ) : filtered.length > 0 ? (
                <ul style={styles.sessionsList}>{filtered.map((s: Session) => <li key={s.id} style={styles.sessionItem} onClick={() => onSelectSession(s)} role="button" tabIndex={0}><div style={styles.sessionItemInfo}><strong style={styles.sessionItemTitle}>{s.metadata.title}</strong><span style={styles.sessionItemDate}>{new Date(s.metadata.date).toLocaleDateString()}</span></div><div style={styles.sessionItemStatus}>{s.status === 'processing' && <span style={styles.processingChip}>{t.processing}</span>}{s.status === 'error' && <span style={styles.errorChip}>Error</span>}</div></li>)}</ul>
            ) : (
                <div style={styles.welcomeContainer}><h3>{t.welcomeMessage}</h3><p>{t.welcomeSubtext}</p></div>
            )}
        </div>
    );
};

// --- Transcript Renderer: Securely renders transcript with speaker names ---
const TranscriptRenderer = ({ transcript, speakers }: { transcript: string; speakers: Record<string, string> }) => {
    const speakerLabelRegex = /^(Speaker \d+):(.*)$/;

    return (
        <div>
            {transcript.split('\n').map((line, index) => {
                const match = line.match(speakerLabelRegex);
                if (match) {
                    const speakerId = match[1];
                    const text = match[2];
                    const speakerName = speakers[speakerId] || speakerId;
                    return (
                        <p key={index} style={{ margin: '0 0 0.5em 0' }}>
                            <strong style={{ color: 'var(--accent-primary)' }}>{speakerName}:</strong>
                            <span>{text}</span>
                        </p>
                    );
                }
                // Render empty lines as a break for paragraph spacing, or render non-speaker lines as-is.
                return <p key={index} style={{ margin: '0 0 0.5em 0' }}>{line || <br />}</p>;
            })}
        </div>
    );
};

export const SessionDetailView = ({ session, onBack, onDelete, onTakeAction, onUpdateSpeakerName, editingSpeaker, setEditingSpeaker }: { session: Session, onBack: () => void, onDelete: (id: string) => void, onTakeAction: (item: string, s: Session) => void, onUpdateSpeakerName: (sessionId: string, speakerId: string, newName: string) => void, editingSpeaker: EditingSpeaker | null, setEditingSpeaker: (e: EditingSpeaker | null) => void}) => {
    const { t } = useLocalization();
    const [showExport, setShowExport] = useState(false);
    const [copyStatus, setCopyStatus] = useState('');

    const generateMarkdown = useCallback(() => {
        const { metadata, results, speakers } = session;
        if (!results) return '';
        let transcriptWithNames = results.transcript || '';
        if (speakers) {
             for (const [id, name] of Object.entries(speakers)) {
                transcriptWithNames = transcriptWithNames.replace(new RegExp(`^${id}:`, 'gm'), `${name}:`);
            }
        }

        return `# ${metadata.title}\n\n` +
            `**${t.dateLabel}** ${new Date(metadata.date).toLocaleString()}\n` +
            `**${t.meetingLocation}** ${metadata.location}\n\n` +
            `## ${t.summaryHeader}\n\n${results.summary || t.noSummary}\n\n` +
            `## ${t.actionItemsHeader}\n\n${results.actionItems.length > 0 ? results.actionItems.map((item:string) => `- ${item}`).join('\n') : t.noActionItems}\n\n` +
            `## ${t.speakersHeader}\n\n${Object.values(speakers || {}).length > 0 ? Object.values(speakers).map(name => `- ${name}`).join('\n') : ''}\n\n` +
            `## ${t.transcriptHeader}\n\n${transcriptWithNames || t.noTranscript}`;
    }, [session, t]);

    const handleCopy = () => {
        const markdown = generateMarkdown();
        navigator.clipboard.writeText(markdown).then(() => {
            setCopyStatus(t.copiedSuccess);
            setTimeout(() => { setCopyStatus(''); setShowExport(false); }, 2000);
        }).catch(() => setCopyStatus('Failed to copy'));
    };

    const handleDownload = () => {
        const markdown = generateMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = session.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${filename || 'meeting_notes'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExport(false);
    };

    return (
        <div style={styles.detailView}>
            <div style={styles.detailHeader}>
                <button onClick={onBack} style={styles.backButton}>&lt; {t.backToList}</button>
                {session.status === 'completed' && (
                    <div style={styles.detailHeaderActions}>
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowExport(p => !p)} style={styles.secondaryButton}>{t.exportResults}</button>
                            {showExport && (
                                <div style={styles.exportMenu}>
                                    <button style={styles.exportMenuItem} onClick={handleCopy}>{copyStatus || t.copyMarkdown}</button>
                                    <button style={styles.exportMenuItem} onClick={handleDownload}>{t.downloadMarkdown}</button>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onDelete(session.id)} style={styles.deleteButton}>{t.deleteSession}</button>
                    </div>
                )}
            </div>
            <h1 style={styles.detailTitle}>{session.metadata.title}</h1>
            <p style={styles.detailMeta}>{new Date(session.metadata.date).toLocaleString()}</p>
            <p style={styles.detailMeta}>📍 <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer" style={{color: 'var(--text-secondary)', textDecoration: 'underline'}}>{session.metadata.location}</a></p>
            
            <div style={{marginTop: '24px'}}>
            {session.status === 'completed' && session.results ? (
                <>
                    <Accordion title={t.summaryHeader} defaultOpen><div style={styles.contentBlock} dangerouslySetInnerHTML={{ __html: marked.parse(session.results.summary || t.noSummary) }}></div></Accordion>
                    <Accordion title={t.actionItemsHeader} defaultOpen><ul style={styles.actionItemsList}>{session.results.actionItems.length > 0 ? session.results.actionItems.map((item:string, i:number) => <li key={i} style={styles.actionItem}><span>{item}</span><button style={styles.takeActionButton} onClick={() => onTakeAction(item, session)}>{t.takeAction}</button></li>) : <li>{t.noActionItems}</li>}</ul></Accordion>
                    <Accordion title={t.speakersHeader}><ul style={styles.speakersList}>{Object.entries(session.speakers || {}).map(([id, name]) => <li key={id} style={styles.speakerItem}>{editingSpeaker?.speakerId === id ? <form style={{display: 'flex', width: '100%', gap: '8px'}} onSubmit={e => { e.preventDefault(); onUpdateSpeakerName(session.id, id, (e.target as any).speakerName.value); }}><input name="speakerName" type="text" defaultValue={name as string} onBlur={e => onUpdateSpeakerName(session.id, id, e.target.value)} autoFocus style={styles.speakerInput} /></form> : <><span>{name as string}</span><button onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })} style={styles.editSpeakerButton}>✏️</button></>}</li>)}</ul></Accordion>
                    <Accordion title={t.transcriptHeader}>
                        <div style={styles.transcriptContainer}>
                             {session.results.transcript ? (
                                <TranscriptRenderer transcript={session.results.transcript} speakers={session.speakers} />
                            ) : (
                                t.noTranscript
                            )}
                        </div>
                    </Accordion>
                </>
            ) : session.status === 'processing' ? <p>{t.processing}</p> : <p style={styles.errorText}>{session.error || t.processingError}</p>}
            </div>
        </div>
    );
};

export const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void}) => {
    const { t } = useLocalization();
    return <nav style={styles.bottomNav}><button style={{...styles.navButton, ...(activeTab === 'record' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('record')}>{t.record}</button><button style={{...styles.navButton, ...(activeTab === 'sessions' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('sessions')}>{t.sessions}</button></nav>;
};

export const LoginView = ({ prompt, onSignIn, error }: { prompt: string; onSignIn: () => void; error: string | null; }) => {
    const { t } = useLocalization();
    return (
        <div style={styles.loginView}>
            <p>{prompt}</p>
            {error && <p style={styles.errorText}>{error}</p>}
            <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>
        </div>
    );
};

export const Modal = ({ title, onClose, children }: ModalProps) => <div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContainer} onClick={e => e.stopPropagation()}><div style={styles.modalHeader}><h3 style={styles.modalTitle}>{title}</h3><button style={styles.modalCloseButton} onClick={onClose}>&times;</button></div><div style={styles.modalBody}>{children}</div></div></div>;

export const ActionModal = ({ data, user, onClose }: { data: ActionModalData, user: User | null, onClose: () => void }) => {
    const { t } = useLocalization();
    const { type, args, sourceItem } = data;
    const [copied, setCopied] = useState(false);
    const copy = (text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    const content = () => {
        switch (type) {
            case 'create_calendar_event': {
                const { title, description, date, time } = args;
                const toGoogleFormat = (d: Date) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15);
                const toOutlookFormat = (d: Date) => d.toISOString().slice(0, 19);
                const startDate = new Date(`${date}T${time}:00`);
                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Assume 1 hour

                const googleUrl = new URL('https://calendar.google.com/calendar/render');
                googleUrl.searchParams.set('action', 'TEMPLATE');
                googleUrl.searchParams.set('text', title);
                googleUrl.searchParams.set('details', description);
                googleUrl.searchParams.set('dates', `${toGoogleFormat(startDate)}/${toGoogleFormat(endDate)}`);

                const outlookUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
                outlookUrl.searchParams.set('path', '/calendar/action/compose');
                outlookUrl.searchParams.set('rru', 'addevent');
                outlookUrl.searchParams.set('subject', title);
                outlookUrl.searchParams.set('body', description);
                outlookUrl.searchParams.set('startdt', toOutlookFormat(startDate));
                outlookUrl.searchParams.set('enddt', toOutlookFormat(endDate));
                
                return <div>
                    <p><strong>{t.titleLabel}</strong> {title}</p>
                    <p><strong>{t.descriptionLabel}</strong> {description}</p>
                    <p><strong>{t.dateLabel}</strong> {date} <strong>{t.timeLabel}</strong> {time}</p>
                    <div style={styles.calendarButtonsContainer}>
                        <a href={googleUrl.toString()} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>
                             <img src="https://www.gstatic.com/images/branding/product/2x/calendar_48dp.png" alt="" style={styles.calendarIcon} />
                            {t.openInGoogleCalendar}
                        </a>
                        <a href={outlookUrl.toString()} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>
                            <img src="https://img.icons8.com/color/48/000000/outlook-calendar.png" alt="" style={styles.calendarIcon} />
                            {t.openInOutlookCalendar}
                        </a>
                    </div>
                </div>;
            }
            case 'draft_email': { const { to, subject, body } = args; return <div><h4>{t.draftEmail}</h4><p><strong>{t.toLabel}</strong> {to}</p><p><strong>{t.subjectLabel}</strong> {subject}</p><p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p><a href={`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} target="_blank" style={styles.actionButton}>{t.openInEmailApp}</a></div>; }
            case 'draft_invoice_email': { const { recipient_name, item_description, amount } = args; const body = t.invoiceEmailBody.replace('{recipientName}', recipient_name).replace('{itemDescription}', sourceItem || item_description).replace('{currencySymbol}', '$').replace('{amount}', amount).replace('{userName}', user?.displayName || ''); return <div><h4>{t.draftInvoiceEmail}</h4><p><strong>{t.recipientNameLabel}</strong> {recipient_name}</p><p><strong>{t.amountLabel}</strong> ${amount}</p><p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p><a href={`mailto:?subject=${encodeURIComponent(`Invoice for ${item_description}`)}&body=${encodeURIComponent(body)}`} target="_blank" style={styles.actionButton}>{t.openInEmailApp}</a></div>; }
            case 'initiate_phone_call': { const { phone_number, reason } = args; return <div><h4>{t.initiatePhoneCall}</h4><p><strong>{t.phoneNumberLabel}</strong> {phone_number}</p><p><strong>{t.reasonLabel}</strong> {reason}</p><a href={`tel:${phone_number}`} style={styles.actionButton}>{t.callNow}</a></div>; }
            case 'create_google_doc': { const { title, content } = args; return <div><h4>{t.createDocument}</h4><p>{t.createDocInfo}</p><p><strong>{t.suggestedTitle}</strong> {title}</p><p><strong>{t.suggestedContent}</strong> <pre style={styles.preformattedText}>{content}</pre></p><button style={styles.actionButton} onClick={() => { copy(content); window.open(`https://docs.google.com/document/create?title=${encodeURIComponent(title)}`, '_blank'); }}>{copied ? t.copiedSuccess : t.openGoogleDocs}</button></div>; }
            case 'error': return <p style={styles.errorText}>{t.actionError}</p>;
            default: return <p>{t.noActionDetermined}</p>;
        }
    };
    const titleMap: Record<string, string> = { create_calendar_event: t.addToCalendar, draft_email: t.draftEmail, draft_invoice_email: t.draftInvoiceEmail, initiate_phone_call: t.initiatePhoneCall, create_google_doc: t.createDocument };
    const title = titleMap[type] || t.takeAction;
    return <Modal title={title} onClose={onClose}><p style={styles.sourceItemText}>"{sourceItem}"</p>{content()}</Modal>;
};

export const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return <div style={styles.accordionContainer}><button style={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>{title}<span>{isOpen ? '−' : '+'}</span></button>{isOpen && <div style={styles.accordionContent}>{children}</div>}</div>;
};

export const DedicationModal = ({ onClose }: { onClose: () => void }) => {
    const dedicationText = "Lovingly dedicated to moms and the Creator. ❤️";

    useEffect(() => {
        const timeout = setTimeout(onClose, 8000); // Auto-close after 8 seconds
        return () => clearTimeout(timeout);
    }, [onClose]);

    return (
        <div style={styles.dedicationOverlay} onClick={onClose}>
            <div style={styles.confettiContainer}>
                {Array.from({ length: 150 }).map((_, i) => (
                    <div key={i} className="confetti-piece" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 5}s`,
                        backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'][Math.floor(Math.random() * 7)],
                        transform: `rotate(${Math.random() * 360}deg)`
                    }}></div>
                ))}
            </div>
            <div style={styles.dedicationModal} onClick={(e) => e.stopPropagation()}>
                <p style={styles.dedicationText}>{dedicationText}</p>
            </div>
        </div>
    );
};

export const FirebaseConfigWarning = ({ children }: { children?: React.ReactNode }) => {
    const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("AIzaSyBjEvuItFoeMQRo3K9poC179RayWSNGRsw") && firebaseConfig.projectId && !firebaseConfig.projectId.includes("gen-lang-client-0046527508");

    if (isFirebaseConfigured) {
        return <>{children}</>;
    }

    return (
        <div style={styles.configWarningOverlay}>
            <div style={styles.configWarningBox}>
                <h2 style={{color: '#FF4136'}}>Firebase Not Configured</h2>
                <p>This application requires Firebase to function correctly. Please follow these steps:</p>
                <ol style={{lineHeight: 1.6}}>
                    <li>Create a Firebase project at <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent-primary)'}}>firebase.google.com</a>.</li>
                    <li>In your project settings, add a new Web App.</li>
                    <li>Copy the `firebaseConfig` object provided.</li>
                    <li>Paste it into the `firebaseConfig` constant in <strong>public/config.ts</strong> to replace the placeholder values.</li>
                </ol>
                <p>The app will not work until this is configured.</p>
            </div>
        </div>
    );
};

// --- Main App Component ---
export const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'preparing' | 'recording' | 'saving'>('idle');
    const [recordingTime, setRecordingTime] = useState(0);
    const [showActionModal, setShowActionModal] = useState<ActionModalData | null>(null);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'record' | 'sessions'>('record');
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
    const isMounted = useRef(true);
    const recordingStatusRef = useRef(recordingStatus);
    const recordingTimeRef = useRef(recordingTime);
    
    useEffect(() => {
        recordingStatusRef.current = recordingStatus;
        recordingTimeRef.current = recordingTime;
    }, [recordingStatus, recordingTime]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

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
            if (!isMounted.current) return null;
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
            if (!isMounted.current) return;
            if (u) {
                console.log(`Auth state changed: User signed in as ${u.displayName} (${u.uid})`);
            } else {
                console.log("Auth state changed: User signed out.");
                setSessions([]);
                setSessionsLoading(false);
            }
            setUser(u);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) { setSessions([]); return; }
        setSessionsLoading(true);
        const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('metadata.date', 'desc'));
        const unsub = onSnapshot(q,
            (snap) => {
                if (!isMounted.current) return;
                const sessionData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
                console.log(`Firestore listener: Received ${sessionData.length} sessions for user ${user.uid}.`);
                setSessions(sessionData);
                setSessionsLoading(false);
            },
            (error) => {
                console.error("Firestore listener error:", error);
                if (isMounted.current) {
                    setError("Could not load sessions due to a database error.");
                    setSessionsLoading(false);
                }
            }
        );
        return () => unsub();
    }, [user]);

    useEffect(() => localStorage.setItem('verbatim_keepAwake', JSON.stringify(keepAwakeEnabled)), [keepAwakeEnabled]);

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
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
                        isRecording: recordingStatusRef.current === 'recording',
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
        const isRecording = recordingStatus === 'recording';
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
    }, [recordingStatus, recordingTime]);
    
    const handleStartRecording = async (deviceId: string) => {
        if (!auth.currentUser) return;
        const currentUser = auth.currentUser;
        if (!isMounted.current) return;
        setShowDeviceSelector(false);
        setRecordingStatus('preparing');
        audioChunksRef.current = [];
    
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        } catch (err) {
            console.error("Recording setup failed: Could not get user media.", err);
            if(isMounted.current) {
                setError(t.micPermissionError);
                setRecordingStatus('idle');
            }
            return; 
        }
        
        const newSessionId = `session_${Date.now()}`;
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSessionId);
    
        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })).catch(() => null);
            let locationName = t.locationUnavailable, mapUrl = '';
            if (pos) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                    if (res.ok) { const data = await res.json(); locationName = data.display_name; mapUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`; }
                } catch (e) { console.warn("Could not fetch location name", e); }
            }
    
            const preliminarySession: Omit<Session, 'id' | 'results' | 'speakers'> = { metadata: { title: `Meeting - ${new Date().toLocaleString()}`, date: new Date().toISOString(), location: locationName, mapUrl }, status: 'processing' };
            await setDoc(sessionDocRef, preliminarySession);

            if (!isMounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
            const newSessionData = { ...preliminarySession, id: newSessionId, results: { transcript: '', summary: '', actionItems: [] }, speakers: {} };
            setSelectedSession(newSessionData);
            setActiveTab('sessions');
    
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            
            mediaRecorderRef.current.onstop = async () => {
                if (isMounted.current) setRecordingStatus('saving');
                releaseWakeLock();
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
    
                if (audioBlob.size < 2000) {
                    await deleteDoc(sessionDocRef);
                    if (isMounted.current) setError(t.recordingTooShortError);
                } else if (!navigator.onLine) {
                    await updateDoc(sessionDocRef, { status: 'error', error: t.offlineError });
                     if (isMounted.current) setError(t.offlineError);
                } else {
                    try {
                        const storageRef = ref(storage, `recordings/${currentUser.uid}/${newSessionId}.webm`);
                        await uploadBytes(storageRef, audioBlob);
                        const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                        await analyzeAudio({ sessionId: newSessionId, prompt: t.analysisPrompt });
                    } catch (e) {
                        console.error("Analysis/upload failed.", e);
                        await updateDoc(sessionDocRef, { status: 'error', error: t.processingError });
                        if (isMounted.current) setError(t.processingError);
                    }
                }
                if (isMounted.current) setRecordingStatus('idle');
            };
    
            mediaRecorderRef.current.start();
            setRecordingStatus('recording');
            setRecordingTime(0);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
            if (keepAwakeEnabled) requestWakeLock();

        } catch (err) {
            console.error("Session creation or recording start failed:", err);
            stream.getTracks().forEach(track => track.stop());
            await deleteDoc(sessionDocRef).catch(() => {});
            if (isMounted.current) {
                setError(t.processingError);
                setRecordingStatus('idle');
            }
        }
    };
    
    const handleStartRecordingClick = async () => {
        setError(null);
        if (!navigator.onLine) {
            setError(t.offlineRecordingError);
            return;
        }
        if(!user) {
            const signedInUser = await signInWithGoogle();
            if (!signedInUser) return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
            if (isMounted.current) {
                setAvailableDevices(devices);
                setShowDeviceSelector(true);
            }
            stream.getTracks().forEach(track => track.stop());
        } catch (err) { 
            if (isMounted.current) setError(t.micPermissionError); 
        }
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
            if (isMounted.current) {
                if (call) setShowActionModal({ type: call.name, args: call.args, sourceItem: item });
                else setShowActionModal({ type: 'unknown', sourceItem: item });
            }
        } catch (err) { 
            if (isMounted.current) setShowActionModal({ type: 'error' }); 
        }
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
        
        if (activeTab === 'sessions') {
            return user ? <SessionsListView sessions={sessions} onSelectSession={setSelectedSession} searchQuery={searchQuery} setSearchQuery={setSearchQuery} isLoading={sessionsLoading} /> : <LoginView prompt={t.signInToView} onSignIn={signInWithGoogle} error={error} />;
        }
    
        // Default to 'record' tab
        if (!user) {
            return <LoginView prompt={t.signInToRecord} onSignIn={signInWithGoogle} error={error} />;
        }
        return <RecordView recordingStatus={recordingStatus} recordingTime={recordingTime} error={error} user={user} onStopRecording={handleStopRecording} onStartRecordingClick={handleStartRecordingClick} keepAwake={keepAwakeEnabled} setKeepAwake={setKeepAwakeEnabled} onTogglePip={openPipWindow} />;
    };

    return (
        <FirebaseConfigWarning>
            <div style={styles.appContainer}>
                <Header user={user} onSignIn={signInWithGoogle} onLogoClick={handleLogoClick} />
                <main style={styles.mainContent}>{renderContent()}</main>
                {!selectedSession && <BottomNav activeTab={activeTab} setActiveTab={(tab) => {setSelectedSession(null); setActiveTab(tab as any)}} />}
                {showDeviceSelector && <Modal title={t.selectAudioDeviceTitle} onClose={() => setShowDeviceSelector(false)}><p>{t.selectAudioDeviceInstruction}</p><ul style={styles.deviceList}>{availableDevices.map((d, i) => <li key={d.deviceId} style={styles.deviceItem} onClick={() => handleStartRecording(d.deviceId)}>{d.label || `Mic ${i + 1}`}</li>)}</ul></Modal>}
                {showActionModal && <ActionModal data={showActionModal} user={user} onClose={() => setShowActionModal(null)} />}
                {showDedication && <DedicationModal onClose={() => setShowDedication(false)} />}
            </div>
        </FirebaseConfigWarning>
    );
};