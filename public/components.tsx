
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
import firebase from 'firebase/compat/app';

import { Session, ActionModalData, ModalProps, AccordionProps, EditingSpeaker, ActiveTab } from './types.ts';
import { useLocalization, useTheme } from './contexts.tsx';
import { styles } from './styles.ts';
import { ai } from './services.ts';
import { firebaseConfig, tools } from './config.ts';
import { useKeepAwake, useAuth, usePictureInPicture, useRecorder, useSessions } from './hooks.ts';

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

const Header = React.memo(({ onLogoClick }: { onLogoClick: () => void }) => {
    const { t, lang, setLang } = useLocalization();
    const { theme, toggleTheme } = useTheme();
    const { user, signIn, signOut } = useAuth();

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value as any;
        console.info(`[Header] Language changed to: ${newLang}`);
        setLang(newLang);
    };

    const handleThemeToggle = () => {
        console.info(`[Header] Theme toggled. Current theme: ${theme}`);
        toggleTheme();
    };

    return (
        <header style={styles.header}>
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo">
                <img src="/icon.svg" alt="" style={styles.logoIcon} />
                <span style={styles.logoText}>{t.title}</span>
            </div>
            <div style={styles.headerControls}>
                 {user && <span style={{color: 'var(--text-secondary)', marginRight: '10px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px'}}>{t.welcomeUser.replace('{name}', user.displayName || 'User')}</span>}
                 <select value={lang} onChange={handleLanguageChange} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={handleThemeToggle} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? <button onClick={signOut} style={styles.secondaryButton}>{t.signOut}</button> : <button onClick={signIn} style={styles.primaryButton}>{t.signIn}</button>}
            </div>
        </header>
    );
});

const MicrophoneIcon = React.memo(() => (
    <svg width="50%" height="50%" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" className="mic-icon">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
));
const StopIcon = React.memo(() => <svg width="40%" height="40%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect width="14" height="14" x="5" y="5" rx="2" /></svg>);

// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
const RecordView = ({ user }: { user: firebase.User | null }) => {
    const { t } = useLocalization();
    const { isRecording, recordingTime, status, analyser, startRecording, stopRecording } = useRecorder(user);
    const { updatePip } = usePictureInPicture();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
     useEffect(() => {
        updatePip(isRecording, recordingTime);
    }, [isRecording, recordingTime, updatePip]);
    
    const drawVisualizer = useCallback(() => {
        if (!isRecording || !analyser || !canvasRef.current) return;
        
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
    }, [isRecording, analyser]);

    useEffect(() => {
        if (isRecording && analyser) {
            drawVisualizer();
        }
    }, [isRecording, analyser, drawVisualizer]);


    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const isProcessing = status === t.analyzing || status === t.preparing;

    const handleButtonClick = () => {
        if (!user) return; // Button should be disabled anyway
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };
    
    useEffect(() => {
        console.debug(`[RecordView] Status changed: "${status}"`);
    }, [status]);
    
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
                        {user ? (status || t.tapToRecord) : t.signInToRecord}
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
        console.debug(`[ToggleSwitch] ${id} toggled to ${checked}`);
        setIsChecked(checked);
        if (id === 'keep-awake') {
            checked ? requestWakeLock() : releaseWakeLock();
        } else if (id === 'pip-mode' && isPipSupported) {
            checked ? requestPip() : closePip();
        }
    };
    
    useEffect(() => {
        if (id === 'pip-mode' && isPipSupported && isPipOpen !== isChecked) {
             console.debug(`[ToggleSwitch] Syncing PiP state. Is open: ${isPipOpen}`);
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

// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
const SessionsView = ({ sessions, onSelectSession, isLoading, user }: { sessions: Session[]; onSelectSession: (session: Session) => void; isLoading: boolean; user: firebase.User | null; }) => {
    const { t } = useLocalization();
    const [searchTerm, setSearchTerm] = useState('');
    
    console.debug(`[SessionsView] Render. isLoading: ${isLoading}, Session count: ${sessions.length}`);

    const filteredSessions = useMemo(() => {
        const filtered = sessions.filter(session =>
            session.metadata.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.metadata.date.includes(searchTerm)
        );
        console.debug(`[SessionsView] Search filtered ${sessions.length} sessions down to ${filtered.length} with term "${searchTerm}"`);
        return filtered;
    }, [sessions, searchTerm]);

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
                    {console.debug('[SessionsView] Rendering skeleton loaders.')}
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
                                    <span style={styles.sessionItemDate}>{new Date(session.metadata.date).toLocaleString()}</span>
                                </div>
                                <div style={styles.sessionItemStatus}>
                                    {session.status === 'processing' && <div style={styles.processingChip}>{t.processing}</div>}
                                    {session.status === 'error' && <div style={styles.errorChip}>Error</div>}
                                    <span>&gt;</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// --- Added Missing Components ---

const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={styles.accordionContainer}>
            <button style={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                <span>{title}</span>
                <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {isOpen && <div style={styles.accordionContent}>{children}</div>}
        </div>
    );
};

const Modal = ({ children, onClose, title }: ModalProps) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContainer} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>{title}</h3>
                    <button onClick={onClose} style={styles.modalCloseButton} aria-label="Close modal">&times;</button>
                </div>
                <div style={styles.modalBody}>{children}</div>
            </div>
        </div>
    );
};

const ActionModal = ({ data, session, onClose, setToastMessage }: { data: ActionModalData | null; session: Session, onClose: () => void; setToastMessage: (message: string) => void }) => {
    const { t } = useLocalization();
    const [isLoading, setIsLoading] = useState(true);
    const [actionResult, setActionResult] = useState<{type: string; args: any} | null>(null);
    const [error, setError] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        if (!data || !data.sourceItem) return;

        const generateAction = async () => {
            console.info(`[ActionModal] Generating action for item: "${data.sourceItem}"`);
            setIsLoading(true);
            setError('');
            setActionResult(null);
            try {
                const prompt = t.actionPrompt
                    .replace('{meetingTitle}', session.metadata.title)
                    .replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString())
                    .replace('{meetingSummary}', session.results.summary)
                    .replace('{actionItemText}', data.sourceItem!);
                
                console.debug('[ActionModal] Sending prompt to Gemini for function calling...');
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        tools: [{ functionDeclarations: tools }],
                    }
                });
                
                if (response.functionCalls && response.functionCalls.length > 0) {
                    const functionCall = response.functionCalls[0];
                    console.info(`[ActionModal] Gemini returned function call: ${functionCall.name}`, functionCall.args);
                    setActionResult({ type: functionCall.name, args: functionCall.args });
                } else {
                    console.warn('[ActionModal] Gemini did not return a function call.');
                    setError(t.noActionDetermined);
                }
            } catch (err) {
                console.error("[ActionModal] Error generating action:", err);
                setError(t.actionError);
            } finally {
                setIsLoading(false);
            }
        };

        generateAction();
    }, [data, session, t]);

    const renderActionContent = () => {
        if (isLoading) return <LoadingSpinner />;
        if (error) return <p style={styles.errorText}>{error}</p>;
        if (!actionResult) return null;

        const { type, args } = actionResult;

        switch (type) {
            case 'create_calendar_event': {
                const { title, description, date, time } = args;
                const start = `${date}T${time}:00`;
                const gcalLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(description || '')}&dates=${encodeURIComponent(start)}/${encodeURIComponent(start)}`;
                return (
                    <div>
                        <p><strong>{t.titleLabel}</strong> {title}</p>
                        <p><strong>{t.descriptionLabel}</strong> {description || 'N/A'}</p>
                        <p><strong>{t.dateLabel}</strong> {date}</p>
                        <p><strong>{t.timeLabel}</strong> {time}</p>
                        <a href={gcalLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInGoogleCalendar}</a>
                    </div>
                );
            }
            case 'draft_email': {
                const { to, subject, body } = args;
                const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                return (
                    <div>
                        <p><strong>{t.toLabel}</strong> {to}</p>
                        <p><strong>{t.subjectLabel}</strong> {subject}</p>
                        <div style={styles.preformattedText}>{body}</div>
                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                );
            }
            case 'draft_invoice_email': {
                const { recipient_name, item_description, amount } = args;
                const body = t.invoiceEmailBody
                    .replace('{recipientName}', recipient_name)
                    .replace('{itemDescription}', item_description)
                    .replace('{currencySymbol}', '$')
                    .replace('{amount}', amount.toString())
                    .replace('{userName}', user?.displayName || '');
                const mailtoLink = `mailto:?subject=${encodeURIComponent(`Invoice for ${item_description}`)}&body=${encodeURIComponent(body)}`;
                return (
                    <div>
                        <p><strong>{t.recipientNameLabel}</strong> {recipient_name}</p>
                        <p><strong>{t.descriptionLabel}</strong> {item_description}</p>
                        <p><strong>{t.amountLabel}</strong> ${amount}</p>
                        <div style={styles.preformattedText}>{body}</div>
                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                );
            }
            case 'initiate_phone_call': {
                const { phone_number, reason } = args;
                const telLink = `tel:${phone_number}`;
                return (
                    <div>
                        <p><strong>{t.phoneNumberLabel}</strong> {phone_number}</p>
                        <p><strong>{t.reasonLabel}</strong> {reason || 'N/A'}</p>
                        <a href={telLink} style={styles.actionButton}>{t.callNow}</a>
                    </div>
                );
            }
            case 'create_google_doc': {
                const { title, content } = args;
                const handleOpenDoc = () => {
                    navigator.clipboard.writeText(content).then(() => {
                        console.debug('[ActionModal] Google Doc content copied to clipboard.');
                        setToastMessage(t.copiedSuccess);
                    });
                    window.open('https://docs.new', '_blank');
                };
                return (
                    <div>
                        <p>{t.createDocInfo}</p>
                        <p><strong>{t.suggestedTitle}</strong> {title}</p>
                        <div style={styles.preformattedText}>{content}</div>
                        <button onClick={handleOpenDoc} style={{...styles.actionButton, width: '100%'}}>{t.openGoogleDocs}</button>
                    </div>
                );
            }
            default:
                return <p style={styles.errorText}>{t.unknownAction}: {type}</p>;
        }
    };
    
    if (!data) return null;

    return (
        <Modal onClose={onClose} title={t.takeAction}>
            <p style={styles.sourceItemText}>"{data.sourceItem}"</p>
            {renderActionContent()}
        </Modal>
    );
};


const DetailView = ({ session, onBack, onDelete, onUpdateSpeaker }: { session: Session; onBack: () => void; onDelete: (sessionId: string) => Promise<boolean>; onUpdateSpeaker: (sessionId: string, speakerId: string, newName: string) => Promise<void>; }) => {
    const { t } = useLocalization();
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [actionModalData, setActionModalData] = useState<ActionModalData | null>(null);
    const [toastMessage, setToastMessage] = useState('');
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    
    console.debug(`[DetailView] Rendering session: ${session.id}`);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleSpeakerSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingSpeaker) return;
        const newName = (e.currentTarget.elements.namedItem('speakerName') as HTMLInputElement).value;
        if (newName) {
            onUpdateSpeaker(editingSpeaker.sessionId, editingSpeaker.speakerId, newName);
        }
        setEditingSpeaker(null);
    };

    const generateMarkdown = () => {
        return `
# ${session.metadata.title}
**${t.dateLabel}** ${new Date(session.metadata.date).toLocaleString()}  
**${t.meetingLocation}** ${session.metadata.location}

## ${t.summaryHeader}
${session.results.summary}

## ${t.actionItemsHeader}
${session.results.actionItems.map(item => `- ${item}`).join('\n')}

## ${t.speakersHeader}
${Object.entries(session.speakers).map(([id, name]) => `- ${id}: ${name}`).join('\n')}

## ${t.transcriptHeader}
${session.results.transcript}
        `.trim();
    };

    const handleExport = (type: 'copy' | 'download') => {
        console.info(`[DetailView] Exporting session ${session.id} as ${type}.`);
        const markdown = generateMarkdown();
        if (type === 'copy') {
            navigator.clipboard.writeText(markdown).then(() => setToastMessage(t.copiedSuccess));
        } else {
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${session.metadata.title.replace(/\s/g, '_')}.md`;
            a.click();
            URL.revokeObjectURL(url);
        }
        setShowExportMenu(false);
    };

    return (
        <div style={styles.detailView}>
            {toastMessage && <Toast message={toastMessage} />}
            {actionModalData && <ActionModal data={actionModalData} session={session} onClose={() => setActionModalData(null)} setToastMessage={setToastMessage} />}

            <div style={styles.detailHeader}>
                <div>
                    <button onClick={onBack} style={styles.backButton}>&larr; {t.backToList}</button>
                    <h2 style={styles.detailTitle}>{session.metadata.title}</h2>
                    <p style={styles.detailMeta}>
                        <span>{new Date(session.metadata.date).toLocaleString()}</span>
                        {session.metadata.location && session.metadata.location !== 'N/A' && (
                            <>
                                <span>&bull;</span>
                                <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer" style={styles.detailMetaLocationLink}>{session.metadata.location}</a>
                            </>
                        )}
                    </p>
                </div>
                <div style={styles.detailHeaderActions}>
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowExportMenu(!showExportMenu)} style={styles.secondaryButton}>{t.exportResults}</button>
                        {showExportMenu && (
                            <div ref={exportMenuRef} style={styles.exportMenu}>
                                <button style={styles.exportMenuItem} onClick={() => handleExport('copy')}>{t.copyMarkdown}</button>
                                <button style={styles.exportMenuItem} onClick={() => handleExport('download')}>{t.downloadMarkdown}</button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => onDelete(session.id).then(success => success && onBack())} style={styles.deleteButton}>{t.deleteSession}</button>
                </div>
            </div>

            <Accordion title={t.summaryHeader} defaultOpen>
                <div style={styles.contentBlock}>{session.results.summary || t.noSummary}</div>
            </Accordion>
            <Accordion title={t.actionItemsHeader} defaultOpen>
                {session.results.actionItems?.length > 0 ? (
                    <ul style={styles.actionItemsList}>
                        {session.results.actionItems.map((item, index) => (
                            <li key={index} style={styles.actionItem}>
                                <span>{item}</span>
                                <button style={styles.takeActionButton} onClick={() => setActionModalData({ type: 'auto', sourceItem: item })}>{t.takeAction}</button>
                            </li>
                        ))}
                    </ul>
                ) : <p>{t.noActionItems}</p>}
            </Accordion>
            <Accordion title={t.speakersHeader}>
                <ul style={styles.speakersList}>
                    {Object.entries(session.speakers || {}).map(([id, name]) => (
                        <li key={id} style={styles.speakerItem}>
                            {editingSpeaker?.speakerId === id ? (
                                <form onSubmit={handleSpeakerSave} style={{ display: 'flex', width: '100%', gap: '8px' }}>
                                    <input name="speakerName" defaultValue={name} style={styles.speakerInput} autoFocus />
                                    <button type="submit" style={styles.primaryButton}>Save</button>
                                    <button type="button" onClick={() => setEditingSpeaker(null)} style={styles.secondaryButton}>Cancel</button>
                                </form>
                            ) : (
                                <>
                                    <span><strong>{id}:</strong> {name}</span>
                                    <button onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })} style={styles.editSpeakerButton}>✏️</button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </Accordion>
            <Accordion title={t.transcriptHeader}>
                <div style={styles.transcriptContainer} dangerouslySetInnerHTML={{ __html: marked(session.results.transcript || t.noTranscript) as string }}></div>
            </Accordion>
        </div>
    );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: ActiveTab; onTabChange: (tab: ActiveTab) => void }) => {
    const { t } = useLocalization();
    const handleTabChange = (tab: ActiveTab) => {
        console.debug(`[BottomNav] Tab changed to: ${tab}`);
        onTabChange(tab);
    };
    return (
        <nav style={styles.bottomNav} className="app-container">
            <button style={{ ...styles.navButton, ...(activeTab === 'record' && styles.navButtonActive) }} onClick={() => handleTabChange('record')}>{t.record}</button>
            <button style={{ ...styles.navButton, ...(activeTab === 'sessions' && styles.navButtonActive) }} onClick={() => handleTabChange('sessions')}>{t.sessions}</button>
        </nav>
    );
};

const ConfigWarning = () => {
    return (
        <div style={styles.configWarningOverlay}>
            <div style={styles.configWarningBox}>
                <h2 style={{ color: '#f94144', marginTop: 0 }}>Configuration Incomplete</h2>
                <p>This application requires Firebase credentials to function.</p>
                <p>Please edit the <code>public/config.ts</code> file and replace the placeholder values in the <code>firebaseConfig</code> object with your own project's configuration from the Firebase console.</p>
                <p>After updating the configuration, refresh the page.</p>
                <p style={{ fontSize: '0.8rem', color: '#888' }}>This warning will disappear once the configuration is valid.</p>
            </div>
        </div>
    );
};

export const App = () => {
    const { user, loading } = useAuth();
    const { sessions, sessionsLoading, deleteSession, updateSpeakerName } = useSessions(user);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    useEffect(() => {
        console.info('[App] Component did mount.');
    }, []);

    const handleSelectSession = (session: Session) => {
        console.info(`[App] Session selected: ${session.id}`);
        setSelectedSession(session);
    };

    const handleBack = () => {
        console.info('[App] Navigating back to sessions list.');
        setSelectedSession(null);
        setActiveTab('sessions');
    };
    
    const handleLogoClick = () => {
        console.info('[App] Logo clicked, navigating to record tab.');
        setSelectedSession(null);
        setActiveTab('record');
    }
    
    // Check if the Firebase config is still using placeholder values.
    const isConfigIncomplete = !firebaseConfig.apiKey || firebaseConfig.apiKey === "";

    if (isConfigIncomplete) {
        console.error('[App] Firebase configuration is incomplete. Showing warning.');
        return <ConfigWarning />;
    }

    if (loading) {
        console.debug('[App] Auth state is loading, showing main spinner.');
        return (
            <div style={styles.loadingContainer}>
                <LoadingSpinner />
            </div>
        );
    }
    
    const mainContent = selectedSession ? (
        <DetailView 
            session={selectedSession} 
            onBack={handleBack}
            onDelete={deleteSession}
            onUpdateSpeaker={updateSpeakerName}
        />
    ) : (
        <>
            {activeTab === 'record' && <RecordView user={user} />}
            {activeTab === 'sessions' && <SessionsView sessions={sessions} onSelectSession={handleSelectSession} isLoading={sessionsLoading} user={user} />}
        </>
    );

    return (
        <div style={styles.appContainer} className="app-container">
            <Header onLogoClick={handleLogoClick} />
            <main style={styles.mainContent}>
                {mainContent}
            </main>
            {!selectedSession && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}
        </div>
    );
};
