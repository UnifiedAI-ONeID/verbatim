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

    return (
        <header style={styles.header}>
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo">
                <img src="/icon.svg" alt="" style={styles.logoIcon} />
                <span style={styles.logoText}>{t.title}</span>
            </div>
            <div style={styles.headerControls}>
                 {user && <span style={{color: 'var(--text-secondary)', marginRight: '10px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px'}}>{t.welcomeUser.replace('{name}', user.displayName || '')}</span>}
                 <select value={lang} onChange={e => setLang(e.target.value as any)} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={toggleTheme} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
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

// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
const SessionsView = ({ sessions, onSelectSession, isLoading, user }: { sessions: Session[]; onSelectSession: (session: Session) => void; isLoading: boolean; user: firebase.User | null; }) => {
    const { t } = useLocalization();
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
                {session.metadata.location && session.metadata.location !== 'N/A' && session.metadata.location !== 'Permission Denied' && (
                  <span style={{display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden'}}>
                    <span>📍</span>
                    <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer" style={styles.detailMetaLocationLink} title={session.metadata.location}>
                      {session.metadata.location}
                    </a>
                  </span>
                )}
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

const Confetti = React.memo(() => {
    return (
        <div id="confetti-container" style={styles.confettiContainer}>
            {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="confetti-piece" style={{
                    left: `${Math.random() * 100}vw`,
                    animationDelay: `${Math.random() * 7}s`,
                    backgroundColor: `hsl(${Math.random() * 360}, 100%, 70%)`,
                }} />
            ))}
        </div>
    );
});

const Dedication = () => {
    return (
        <div style={styles.dedicationOverlay}>
            <Confetti />
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


export const App = () => {
    const { user, loading: authLoading } = useAuth();
    const { t } = useLocalization();
    const { sessions, sessionsLoading, deleteSession, updateSpeakerName } = useSessions(user);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [showDedication, setShowDedication] = useState(false);

    useEffect(() => {
        const hasSeen = localStorage.getItem('verbatim_dedication_seen');
        if (!hasSeen) {
            setShowDedication(true);
            const timer = setTimeout(() => {
                setShowDedication(false);
                localStorage.setItem('verbatim_dedication_seen', 'true');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDelete = async (sessionId: string) => {
        const success = await deleteSession(sessionId);
        if (success) {
            setSelectedSession(null); // Go back to the list view on successful deletion
        }
    };

    const handleViewChange = useCallback((view: ActiveTab) => {
        setSelectedSession(null);
        setActiveTab(view);
    }, []);

    if (authLoading) return <div style={styles.loadingContainer}><LoadingSpinner /></div>;
    
    const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_API_KEY');

    return (
        <div style={styles.appContainer} className="app-container">
            {!isConfigValid && <FirebaseConfigWarning />}
            {showDedication && <Dedication />}
            <Header onLogoClick={() => handleViewChange('record')} />
            <main style={styles.mainContent}>
                {selectedSession ? (
                    <DetailView session={selectedSession} onBack={() => setSelectedSession(null)} onDelete={handleDelete} onSpeakerUpdate={updateSpeakerName} />
                ) : (
                    <>
                        {activeTab === 'record' && <RecordView user={user} />}
                        {activeTab === 'sessions' && <SessionsView sessions={sessions} onSelectSession={setSelectedSession} isLoading={sessionsLoading} user={user} />}
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