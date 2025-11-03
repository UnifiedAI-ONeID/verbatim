import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
// Fix: Use Firebase v8 compat imports to resolve module errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { Session, ActionModalData, ModalProps, AccordionProps, EditingSpeaker, ActiveTab } from './types.ts';
import { useLocalization, useTheme } from './contexts.tsx';
import { styles } from './styles.ts';
import { auth, db, storage, functions, ai } from './services.ts';
import { firebaseConfig, tools } from './config.ts';
import { useKeepAwake } from './hooks.ts';

// --- Error Boundary ---
export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { hasError: boolean }> {
  // Fix: Add constructor to properly initialize props and state for class component.
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("ErrorBoundary caught an error:", error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in React component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', margin: 'auto', textAlign: 'center', color: 'var(--danger)' }}>
          <h2>Something went wrong.</h2>
          <p>Please try refreshing the page. The error has been logged to the console.</p>
          <button style={styles.primaryButton} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UI Components ---
const LoadingSpinner = () => (
    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'conic-gradient(#00DAC6, #f9c74f, #f94144, #90be6d, #00DAC6)', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)', animation: 'spin 1s linear infinite' }} />
);

const Toast = ({ message }: { message: string }) => <div style={styles.toastContainer}>{message}</div>;

const SessionItemSkeleton = () => (
    <li style={{ ...styles.sessionItemButton, ...styles.skeleton }}>
        <div style={styles.sessionItemInfo}>
            <div style={{ ...styles.sessionItemTitle, width: '200px', height: '20px', ...styles.skeleton, backgroundColor: 'var(--bg-2)' }}></div>
            <div style={{ ...styles.sessionItemDate, width: '100px', height: '16px', marginTop: '4px', ...styles.skeleton, backgroundColor: 'var(--bg-2)' }}></div>
        </div>
        <div style={styles.skeletonShine}></div>
    </li>
);

const Header = ({ onLogoClick }: { onLogoClick: () => void }) => {
    const { t, lang, setLang } = useLocalization();
    const { theme, toggleTheme } = useTheme();
    const { user, signIn, signOut: signOutUser } = useAuth();

    return (
        <header style={styles.header}>
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo">
                <img src="/icon.svg" alt="" style={styles.logoIcon} />
                <span style={styles.logoText}>{t.title}</span>
            </div>
            <div style={styles.headerControls}>
                 <select value={lang} onChange={e => setLang(e.target.value as any)} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={toggleTheme} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? <button onClick={signOutUser} style={styles.secondaryButton}>{t.signOut}</button> : <button onClick={signIn} style={styles.primaryButton}>{t.signIn}</button>}
            </div>
        </header>
    );
};

const MicrophoneIcon = () => (
    <svg width="50%" height="50%" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" className="mic-icon">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
);
const StopIcon = () => <svg width="40%" height="40%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect width="14" height="14" x="5" y="5" rx="2" /></svg>;

interface RecordViewProps {
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    recordingTime: number;
    status: string;
    isMicReady: boolean;
}

const RecordView = ({ isRecording, startRecording, stopRecording, recordingTime, status, isMicReady }: RecordViewProps) => {
    const { t } = useLocalization();
    const { user } = useAuth();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    useEffect(() => {
        if (isRecording && isMicReady && canvasRef.current) {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
            }
        } else if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().then(() => {
                audioContextRef.current = null;
                analyserRef.current = null;
                if(sourceRef.current) {
                    sourceRef.current.disconnect();
                    sourceRef.current = null;
                }
            });
        }
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, [isRecording, isMicReady]);

    const drawVisualizer = useCallback(() => {
        if (!isRecording || !analyserRef.current || !canvasRef.current) return;
        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;
        const radius = Math.min(width, height) / 2.5;
        const barCount = 60;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(width / 2, height / 2);

        for (let i = 0; i < barCount; i++) {
            const angle = (i / barCount) * 2 * Math.PI;
            const dataIndex = Math.floor((i / barCount) * bufferLength);
            const barHeight = Math.pow(dataArray[dataIndex] / 255, 2) * 80;

            const x1 = Math.cos(angle) * radius;
            const y1 = Math.sin(angle) * radius;
            const x2 = Math.cos(angle) * (radius + barHeight);
            const y2 = Math.sin(angle) * (radius + barHeight);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(0, 218, 198, ${0.3 + (barHeight / 80) * 0.7})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
        requestAnimationFrame(drawVisualizer);
    }, [isRecording]);

    useEffect(() => {
        if (isRecording && audioContextRef.current && analyserRef.current) {
            navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                    sourceRef.current.connect(analyserRef.current!);
                    drawVisualizer();
                }
            }).catch(err => console.error('Error accessing media stream for visualizer:', err));
        }
    }, [isRecording, drawVisualizer]);


    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const isProcessing = status === 'analyzing' || status === 'preparing';

    const handleButtonClick = () => {
        if (!user) return; // Button should be disabled anyway
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };
    
    return (
        <div style={styles.recordView}>
            <div style={styles.recordButtonContainer}>
                <canvas ref={canvasRef} width="400" height="400" style={styles.visualizerCanvas}></canvas>
                <button
                    onClick={handleButtonClick}
                    style={{
                        ...styles.recordButton,
                        ...(isRecording && styles.recordButtonRecording),
                        ...((!user || isProcessing) && styles.recordButtonDisabled),
                    }}
                    disabled={!user || isProcessing}
                    aria-label={isRecording ? t.stopRecording : t.startRecording}
                >
                    {isProcessing ? <LoadingSpinner /> : (isRecording ? <StopIcon /> : <MicrophoneIcon />)}
                </button>
                {isRecording ? (
                    <div style={styles.timerText}>{formatTime(recordingTime)}</div>
                ) : (
                    <div style={styles.recordButtonText}>
                        {user ? (isProcessing ? status + '...' : t.tapToRecord) : t.signInToRecord}
                    </div>
                )}
            </div>
            <div style={styles.recordFooter}>
                <ToggleSwitch id="keep-awake" label={t.keepAwake} title={t.keepAwakeInfo} />
                <ToggleSwitch id="pip-mode" label={t.toggleMiniView} title={t.toggleMiniView} isPipSupported={!!(document as any).pictureInPictureEnabled} />
            </div>
        </div>
    );
};

const ToggleSwitch = ({ id, label, title, isPipSupported }: { id: string, label: string, title: string, isPipSupported?: boolean }) => {
    const { requestWakeLock, releaseWakeLock } = useKeepAwake();
    const { isPipOpen, requestPip, closePip } = usePictureInPicture();
    const [isChecked, setIsChecked] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsChecked(checked);
        if (id === 'keep-awake') {
            checked ? requestWakeLock() : releaseWakeLock();
        } else if (id === 'pip-mode' && isPipSupported) {
            checked ? requestPip() : closePip();
        }
    };
    
    useEffect(() => {
        if (id === 'pip-mode' && isPipSupported && isPipOpen !== isChecked) {
             setIsChecked(isPipOpen);
        }
    }, [isPipOpen, id, isPipSupported, isChecked]);

    const isToggleDisabled = id === 'pip-mode' && !isPipSupported;

    return (
        <label htmlFor={id} style={{ ...styles.toggleSwitchLabel, opacity: isToggleDisabled ? 0.5 : 1 }} title={isToggleDisabled ? "Picture-in-Picture is not supported in this browser." : title}>
            <span>{label}</span>
            <div style={styles.toggleSwitch}>
                <input id={id} type="checkbox" checked={isChecked} onChange={handleChange} disabled={isToggleDisabled} />
                <span className="slider"></span>
            </div>
        </label>
    );
};

interface SessionsViewProps {
    sessions: Session[];
    onSelectSession: (session: Session) => void;
    isLoading: boolean;
}

const SessionsView = ({ sessions, onSelectSession, isLoading }: SessionsViewProps) => {
    const { t } = useLocalization();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSessions = useMemo(() =>
        sessions.filter(session =>
            session.metadata.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.metadata.date.includes(searchTerm)
        ), [sessions, searchTerm]);

    if (!user) {
        return (
            <div style={styles.loginView}>
                <img src="/icon.svg" alt="Verbatim Logo" style={styles.loginViewIcon} />
                <h2 style={styles.loginViewTitle}>{t.welcomeMessage}</h2>
                <p style={styles.loginViewText}>{t.signInToView}</p>
            </div>
        );
    }
    
    return (
        <div style={styles.sessionsView}>
            <div style={styles.sessionsHeader}>
                <h2 style={styles.sessionsHeaderTitle}>{t.recentSessions}</h2>
                <input
                    type="search"
                    placeholder={t.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                    aria-label={t.searchPlaceholder}
                />
            </div>
            {isLoading ? (
                 <ul style={styles.sessionsList}>
                    {[...Array(3)].map((_, i) => <SessionItemSkeleton key={i} />)}
                </ul>
            ) : filteredSessions.length === 0 ? (
                <div style={styles.welcomeContainer}>
                    <h3>{t.welcomeMessage}</h3>
                    <p>{t.welcomeSubtext}</p>
                </div>
            ) : (
                <ul style={styles.sessionsList}>
                    {filteredSessions.map(session => (
                        <li key={session.id}>
                            <button onClick={() => onSelectSession(session)} style={styles.sessionItemButton}>
                                <div style={styles.sessionItemInfo}>
                                    <strong style={styles.sessionItemTitle}>{session.metadata.title}</strong>
                                    <span style={styles.sessionItemDate}>{session.metadata.date}</span>
                                </div>
                                <div style={styles.sessionItemStatus}>
                                    {session.status === 'processing' && <div style={styles.processingChip}>{t.processing}</div>}
                                    {session.status === 'error' && <div style={styles.errorChip}>Error</div>}
                                    <span style={{ fontSize: '1.2rem' }}>&gt;</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={styles.accordionContainer}>
            <button style={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                <span>{title}</span><span>{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div style={styles.accordionContent}>{children}</div>}
        </div>
    );
};

const Modal = ({ children, onClose, title }: ModalProps) => (
    <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContainer} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{title}</h3>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
            </div>
            <div style={styles.modalBody}>{children}</div>
        </div>
    </div>
);

const DetailView = ({ session, onBack, onDelete, onSpeakerUpdate }: { session: Session; onBack: () => void; onDelete: (sessionId: string) => void; onSpeakerUpdate: (sessionId: string, speakerId: string, newName: string) => void; }) => {
    const { t } = useLocalization();
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [speakerName, setSpeakerName] = useState('');
    const [actionModalData, setActionModalData] = useState<ActionModalData | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    const handleSpeakerSave = () => {
        if (editingSpeaker && speakerName.trim()) {
            onSpeakerUpdate(editingSpeaker.sessionId, editingSpeaker.speakerId, speakerName.trim());
            setEditingSpeaker(null);
        }
    };

    const handleTakeAction = async (item: string) => {
        const { title, date } = session.metadata;
        const { summary } = session.results;
        const prompt = t.actionPrompt.replace('{meetingTitle}', title).replace('{meetingDate}', date).replace('{meetingSummary}', summary).replace('{actionItemText}', item);

        setActionModalData({ type: 'loading', sourceItem: item });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: prompt }] }],
                config: { tools: [{ functionDeclarations: tools }] },
            });
            
            const call = response.functionCalls?.[0];
            if (call) {
                setActionModalData({ type: call.name, args: call.args, sourceItem: item });
            } else {
                setActionModalData({ type: 'unknown', sourceItem: item });
            }
        } catch (error) {
            console.error("Error calling Gemini for action:", error);
            setActionModalData({ type: 'error', sourceItem: item });
        }
    };
    
    const exportAsMarkdown = () => {
        const { metadata, results, speakers } = session;
        let speakerMap = Object.entries(speakers).map(([id, name]) => `*   ${id}: ${name}`).join('\n');
        
        const markdown = `# ${metadata.title}\n\n**Date:** ${metadata.date}\n**Location:** ${metadata.location}\n\n## ✨ Key Summary\n${results.summary}\n\n## 📌 Action Items\n${results.actionItems.map(item => `- ${item}`).join('\n')}\n\n## 🗣️ Speakers\n${speakerMap}\n\n## 📋 Transcript\n${results.transcript}`;
        return markdown;
    };
    
    const handleCopyMarkdown = () => {
        navigator.clipboard.writeText(exportAsMarkdown());
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setShowExportMenu(false);
    };

    const handleDownloadMarkdown = () => {
        const blob = new Blob([exportAsMarkdown()], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.metadata.title.replace(/ /g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const parsedTranscript = useMemo(() => {
        if (!session.results.transcript) return '';
        const speakerRegex = new RegExp(`(${Object.keys(session.speakers).join('|')}):`, 'g');
        return session.results.transcript.replace(speakerRegex, (match, speakerId) => {
            const speakerName = session.speakers[speakerId] || speakerId;
            return `\n**${speakerName}:**`;
        });
    }, [session.results.transcript, session.speakers]);

    return (
        <div style={styles.detailView}>
            <div style={styles.detailHeader}>
                <button style={styles.backButton} onClick={onBack}>&lt; {t.backToList}</button>
                <div style={styles.detailHeaderActions}>
                    <div style={{ position: 'relative' }} ref={exportMenuRef}>
                        <button style={styles.secondaryButton} onClick={() => setShowExportMenu(prev => !prev)}>{t.exportResults} ▾</button>
                        {showExportMenu && (
                            <div style={styles.exportMenu}>
                                <button style={styles.exportMenuItem} onClick={handleCopyMarkdown}>📋 {t.copyMarkdown}</button>
                                <button style={styles.exportMenuItem} onClick={handleDownloadMarkdown}>⬇️ {t.downloadMarkdown}</button>
                            </div>
                        )}
                    </div>
                    <button style={styles.deleteButton} onClick={() => onDelete(session.id)}>🗑️</button>
                </div>
            </div>

            <h1 style={styles.detailTitle}>{session.metadata.title}</h1>
            <div style={styles.detailMeta}>
                <span>🗓️ {session.metadata.date}</span>
                {session.metadata.location && <span>📍 <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer">{session.metadata.location}</a></span>}
            </div>
            
            {session.status === 'error' && <div style={styles.errorText}>{session.error || t.processingError}</div>}
            
            {session.status === 'completed' && <>
                <Accordion title={t.summaryHeader} defaultOpen={true}><div style={styles.contentBlock}>{session.results.summary || t.noSummary}</div></Accordion>
                <Accordion title={t.actionItemsHeader} defaultOpen={true}>
                    {session.results.actionItems && session.results.actionItems.length > 0 ? (
                        <ul style={styles.actionItemsList}>
                            {session.results.actionItems.map((item, index) => (
                                <li key={index} style={styles.actionItem}>
                                    <span>{item}</span>
                                    <button style={styles.takeActionButton} onClick={() => handleTakeAction(item)}>{t.takeAction}</button>
                                </li>
                            ))}
                        </ul>
                    ) : t.noActionItems}
                </Accordion>
                 <Accordion title={t.speakersHeader}>
                    <ul style={styles.speakersList}>
                        {Object.entries(session.speakers).map(([id, name]) => (
                            <li key={id} style={styles.speakerItem}>
                                {editingSpeaker?.speakerId === id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={speakerName}
                                            onChange={(e) => setSpeakerName(e.target.value)}
                                            style={styles.speakerInput}
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && handleSpeakerSave()}
                                            onBlur={handleSpeakerSave}
                                        />
                                        <button onClick={handleSpeakerSave} style={styles.primaryButton}>Save</button>
                                    </>
                                ) : (
                                    <>
                                        <span>{id}: {name}</span>
                                        <button style={styles.editSpeakerButton} onClick={() => { setEditingSpeaker({ sessionId: session.id, speakerId: id }); setSpeakerName(name); }} aria-label={`Edit name for ${name}`}>✏️</button>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                </Accordion>
                <Accordion title={t.transcriptHeader}><div style={styles.transcriptContainer} dangerouslySetInnerHTML={{ __html: marked.parse(parsedTranscript) }}></div></Accordion>
            </>}
            
            {actionModalData && <ActionModal data={actionModalData} onClose={() => setActionModalData(null)} />}
            {showToast && <Toast message={t.copiedSuccess} />}
        </div>
    );
};

const ActionModal = ({ data, onClose }: { data: ActionModalData; onClose: () => void }) => {
    const { t } = useLocalization();
    const { user } = useAuth();
    const { type, args, sourceItem } = data;
    
    if (type === 'loading') return <Modal title={t.analyzing} onClose={onClose}><LoadingSpinner /></Modal>;
    if (type === 'error') return <Modal title={t.actionError} onClose={onClose}><p>{t.actionError}</p></Modal>;
    
    const renderContent = () => {
        switch (type) {
            case 'create_calendar_event':
                const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(args.title)}&dates=${args.date.replace(/-/g, '')}T${args.time.replace(':', '')}00/${args.date.replace(/-/g, '')}T${(parseInt(args.time.split(':')[0]) + 1).toString().padStart(2, '0')}${args.time.split(':')[1]}00&details=${encodeURIComponent(args.description)}`;
                const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(args.title)}&startdt=${args.date}T${args.time}:00&enddt=${args.date}T${(parseInt(args.time.split(':')[0]) + 1).toString().padStart(2, '0')}:${args.time.split(':')[1]}:00&body=${encodeURIComponent(args.description)}`;
                return (
                    <div>
                        <p><strong>{t.titleLabel}</strong> {args.title}</p>
                        <p><strong>{t.descriptionLabel}</strong> {args.description}</p>
                        <p><strong>{t.dateLabel}</strong> {args.date} | <strong>{t.timeLabel}</strong> {args.time}</p>
                        <div style={styles.calendarButtonsContainer}>
                            <a href={gcalUrl} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>
                                <img src="https://www.gstatic.com/images/branding/product/2x/calendar_48dp.png" alt="Google Calendar" style={styles.calendarIcon} />
                                {t.openInGoogleCalendar}
                            </a>
                            <a href={outlookUrl} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>
                                <img src="https://img.icons8.com/color/48/outlook--v1.png" alt="Outlook Calendar" style={styles.calendarIcon} />
                                {t.openInOutlookCalendar}
                            </a>
                        </div>
                    </div>
                );
            case 'draft_email':
                const mailtoLink = `mailto:${args.to}?subject=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
                return (
                    <div>
                        <p><strong>{t.toLabel}</strong> {args.to}</p>
                        <p><strong>{t.subjectLabel}</strong> {args.subject}</p>
                        <p><strong>{t.bodyLabel}</strong></p>
                        <div style={styles.preformattedText}>{args.body}</div>
                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                );
            case 'draft_invoice_email':
                const currencySymbol = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: 'USD' }).formatToParts(1).find(p => p.type === 'currency')?.value || '$';
                const userName = user?.displayName || '';
                const body = t.invoiceEmailBody.replace('{recipientName}', args.recipient_name).replace('{itemDescription}', args.item_description).replace('{currencySymbol}', currencySymbol).replace('{amount}', args.amount).replace('{userName}', userName);
                const subject = `Invoice for ${args.item_description}`;
                const invoiceMailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                 return (
                    <div>
                        <p><strong>{t.recipientNameLabel}</strong> {args.recipient_name}</p>
                        <p><strong>{t.amountLabel}</strong> {currencySymbol}{args.amount}</p>
                        <div style={styles.preformattedText}>{body}</div>
                         <a href={invoiceMailto} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                );
            case 'initiate_phone_call':
                return (
                    <div>
                        <p><strong>{t.phoneNumberLabel}</strong> {args.phone_number}</p>
                        <p><strong>{t.reasonLabel}</strong> {args.reason}</p>
                        <a href={`tel:${args.phone_number}`} style={styles.actionButton}>{t.callNow}</a>
                    </div>
                );
            case 'create_google_doc':
                const handleOpenDocs = () => {
                    navigator.clipboard.writeText(args.content);
                    window.open('https://docs.new', '_blank');
                };
                return (
                    <div>
                        <p>{t.createDocInfo}</p>
                        <p><strong>{t.suggestedTitle}</strong> {args.title}</p>
                        <p><strong>{t.suggestedContent}</strong></p>
                        <div style={styles.preformattedText}>{args.content}</div>
                        <button onClick={handleOpenDocs} style={styles.actionButton}>{t.openGoogleDocs}</button>
                    </div>
                );
            default: return <p>{t.noActionDetermined}</p>;
        }
    };
    
    const getTitle = () => {
        const titleMap: { [key: string]: string } = {
            create_calendar_event: t.createCalendarEvent,
            draft_email: t.draftEmail,
            draft_invoice_email: t.draftInvoiceEmail,
            initiate_phone_call: t.initiatePhoneCall,
            create_google_doc: t.createDocument,
        };
        return titleMap[type] || t.unknownAction;
    };

    return (
        <Modal title={getTitle()} onClose={onClose}>
            {sourceItem && <p style={styles.sourceItemText}>"{sourceItem}"</p>}
            {renderContent()}
        </Modal>
    );
};

const Dedication = () => {
    useEffect(() => {
        const container = document.getElementById('confetti-container');
        if (container) {
            for (let i = 0; i < 100; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = `${Math.random() * 100}vw`;
                confetti.style.animationDelay = `${Math.random() * 6}s`;
                confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`;
                container.appendChild(confetti);
            }
        }
    }, []);

    return (
        <div style={styles.dedicationOverlay}>
            <div id="confetti-container" style={styles.confettiContainer}></div>
            <div style={styles.dedicationModal}>
                <p style={styles.dedicationText}>
                    Dedicated to my incredible parents, whose unwavering support and encouragement have been my greatest inspiration.
                </p>
            </div>
        </div>
    );
};

const FirebaseConfigWarning = () => (
    <div style={styles.configWarningOverlay}>
        <div style={styles.configWarningBox}>
            <h2 style={{ color: 'var(--accent-primary)'}}>Firebase Configuration Needed</h2>
            <p>Welcome to Verbatim! To get started, you need to connect the app to your own Firebase project.</p>
            <ol style={{ lineHeight: 1.6 }}>
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">Firebase Console</a> and create a new project.</li>
                <li>In your project, create a new "Web App".</li>
                <li>Copy the `firebaseConfig` object provided.</li>
                <li>Open the file <strong>public/config.ts</strong> in your code editor.</li>
                <li>Replace the placeholder `firebaseConfig` object with the one you copied from your project.</li>
            </ol>
            <p>Once you save the file, this message will disappear and the app will be ready to use.</p>
        </div>
    </div>
);


// --- Main App Logic & Hooks ---
const useAuth = () => {
    const { t } = useLocalization();
    // Fix: Use firebase.User type from compat library.
    const [user, setUser] = useState<firebase.User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fix: Use auth.onAuthStateChanged method from compat library.
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signIn = async () => {
        // Fix: Use firebase.auth.GoogleAuthProvider from compat library.
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            // Fix: Use auth.signInWithPopup method from compat library.
            await auth.signInWithPopup(provider);
        } catch (error: any) {
            if (error.code === 'auth/popup-blocked') {
                alert(t.signInPopupBlockedError);
            } else {
                console.error("Sign in error:", error);
                alert(t.signInError);
            }
        }
    };
    
    // Fix: Use auth.signOut method from compat library.
    return { user, loading, signIn, signOut: () => auth.signOut() };
};

const usePictureInPicture = () => {
    const pipWindow = useRef<Window | null>(null);
    const [isPipOpen, setIsPipOpen] = useState(false);
    const channel = useMemo(() => new BroadcastChannel('verbatim_pip_channel'), []);

    const requestPip = useCallback(async () => {
        if ((document as any).pictureInPictureEnabled && !pipWindow.current) {
            try {
                pipWindow.current = await (window as any).open('/pip.html', 'VerbatimPIP', 'width=400,height=80,popup');
                setIsPipOpen(true);
                 if (pipWindow.current) {
                    pipWindow.current.addEventListener('beforeunload', () => {
                        setIsPipOpen(false);
                        pipWindow.current = null;
                    });
                }
            } catch (error) {
                console.error('Error opening PiP window:', error);
            }
        }
    }, []);
    
    const closePip = useCallback(() => {
        if (pipWindow.current) {
            pipWindow.current.close();
            pipWindow.current = null;
            setIsPipOpen(false);
        }
    }, []);
    
     useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data.type === 'pip_ready' && isPipOpen) {
                // The main app can send its current state to the new PiP window
            }
        };
        channel.addEventListener('message', handler);
        return () => channel.removeEventListener('message', handler);
    }, [channel, isPipOpen]);

    const updatePip = useCallback((isRecording: boolean, recordingTime: number) => {
        if (isPipOpen) {
            channel.postMessage({ type: 'state_update', isRecording, recordingTime });
        }
    }, [isPipOpen, channel]);

    return { requestPip, closePip, updatePip, isPipOpen };
};

export const App = () => {
    const { user, loading: authLoading } = useAuth();
    const { t } = useLocalization();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [status, setStatus] = useState('');
    const [isMicReady, setIsMicReady] = useState(false);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [showDedication, setShowDedication] = useState(true);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const { updatePip } = usePictureInPicture();
    
    useEffect(() => {
        const timer = setTimeout(() => setShowDedication(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!user) {
            setSessions([]);
            setSessionsLoading(false);
            return;
        }
        setSessionsLoading(true);
        const q = query(collection(db, `users/${user.uid}/sessions`), orderBy('metadata.date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(userSessions);
            setSessionsLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setSessionsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        updatePip(isRecording, recordingTime);
    }, [isRecording, recordingTime, updatePip]);

    const handleNewSession = async () => {
        if (!user) return;
        setStatus(t.preparing);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsMicReady(true);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = event => audioChunksRef.current.push(event.data);
            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
                clearInterval(timerRef.current!);
                
                if (audioChunksRef.current.length === 0 || recordingTime < 2) {
                    setStatus(t.recordingTooShortError);
                    setTimeout(() => setStatus(''), 3000);
                    return;
                }
                
                setStatus(t.analyzing);
                
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                const sessionId = doc(collection(db, 'users')).id;
                const storageRef = ref(storage, `recordings/${user.uid}/${sessionId}.webm`);
                
                try {
                    await uploadBytes(storageRef, audioBlob);
                    
                    const newSession: Omit<Session, 'id'> = {
                        metadata: { title: `Session ${new Date().toLocaleString()}`, date: new Date().toISOString(), location: '', mapUrl: '' },
                        results: { transcript: '', summary: '', actionItems: [] },
                        speakers: {},
                        status: 'processing'
                    };
                    await setDoc(doc(db, `users/${user.uid}/sessions/${sessionId}`), newSession);
                    
                    const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                    await analyzeAudio({ sessionId, prompt: t.analysisPrompt });

                } catch (error) {
                    console.error("Error during upload/analysis:", error);
                    setStatus(t.processingError);
                    const sessionDocRef = doc(db, `users/${user.uid}/sessions/${sessionId}`);
                    await updateDoc(sessionDocRef, { status: 'error', error: 'Upload or function call failed.' });
                } finally {
                    setStatus('');
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setStatus('');
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            
        } catch (err) {
            console.error('Error starting recording:', err);
            setStatus(t.micPermissionError);
            setIsMicReady(false);
        }
    };
    
    const handleStopRecording = () => mediaRecorderRef.current?.stop();
    const handleDeleteSession = async (sessionId: string) => {
        if (!user) return;
        if (window.confirm(t.deleteConfirmation)) {
            try {
                await deleteDoc(doc(db, `users/${user.uid}/sessions/${sessionId}`));
                const storageRef = ref(storage, `recordings/${user.uid}/${sessionId}.webm`);
                await deleteObject(storageRef);
                setSelectedSession(null);
            } catch (error) {
                console.error("Error deleting session:", error);
            }
        }
    };
    
    const handleSpeakerUpdate = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user) return;
        const sessionDocRef = doc(db, `users/${user.uid}/sessions/${sessionId}`);
        await updateDoc(sessionDocRef, { [`speakers.${speakerId}`]: newName });
    };

    const handleViewChange = (view: ActiveTab) => {
        setSelectedSession(null);
        setActiveTab(view);
    };

    if (authLoading) return <div style={styles.loadingContainer}><LoadingSpinner /></div>;
    
    const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_API_KEY');

    return (
        <div style={styles.appContainer}>
            {!isConfigValid && <FirebaseConfigWarning />}
            {showDedication && <Dedication />}
            <Header onLogoClick={() => handleViewChange('record')} />
            <main style={styles.mainContent}>
                {selectedSession ? (
                    <DetailView session={selectedSession} onBack={() => setSelectedSession(null)} onDelete={handleDeleteSession} onSpeakerUpdate={handleSpeakerUpdate} />
                ) : (
                    <>
                        {activeTab === 'record' && <RecordView isRecording={isRecording} startRecording={handleNewSession} stopRecording={handleStopRecording} recordingTime={recordingTime} status={status} isMicReady={isMicReady} />}
                        {activeTab === 'sessions' && <SessionsView sessions={sessions} onSelectSession={setSelectedSession} isLoading={sessionsLoading} />}
                    </>
                )}
            </main>
            <nav style={styles.bottomNav}>
                <button style={{ ...styles.navButton, ...(activeTab === 'record' && styles.navButtonActive) }} onClick={() => handleViewChange('record')}>{t.record}</button>
                <button style={{ ...styles.navButton, ...(activeTab === 'sessions' && styles.navButtonActive) }} onClick={() => handleViewChange('sessions')}>{t.sessions}</button>
            </nav>
        </div>
    );
};