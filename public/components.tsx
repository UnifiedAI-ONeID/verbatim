
import React, { useState, useCallback, useEffect } from 'react';
import { User, signOut as firebaseSignOut } from "firebase/auth";
import { marked } from 'marked';

import { Session, ActionModalData, ModalProps, AccordionProps, EditingSpeaker } from './types';
import { useLocalization, useTheme } from './contexts';
import { styles } from './styles';
import { auth } from './services';
import { firebaseConfig } from './config';

// --- Loading Component ---
export const LoadingSpinner = ({ fullScreen = false }: { fullScreen?: boolean }) => {
    const spinnerStyle: React.CSSProperties = {
        width: '50px',
        height: '50px',
        border: '4px solid var(--bg-3)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
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
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo"><img src="/icon.svg" alt="" style={{ width: '32px', height: '32px', borderRadius: '8px' }} /><span style={{color: 'var(--accent-primary)'}}>{t.title}</span></div>
            <div style={styles.headerControls}>
                 <select value={lang} onChange={e => setLang(e.target.value as any)} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={toggleTheme} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? <button onClick={handleSignOut} style={styles.secondaryButton}>{t.signOut}</button> : <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>}
            </div>
        </header>
    );
};

export const RecordView = ({ isRecording, recordingTime, isSaving, error, user, onStopRecording, onStartRecordingClick, keepAwake, setKeepAwake, onTogglePip }: any) => {
    const { t } = useLocalization();
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    return (
        <div style={styles.recordView}>
            <div style={styles.recordButtonContainer}>
                <button style={{ ...styles.recordButton, ...(isRecording ? styles.recordButtonRecording : {}) }} onClick={isRecording ? onStopRecording : onStartRecordingClick} aria-label={isRecording ? t.stopRecording : t.startRecording}>{isRecording ? '⏹️' : '🎤'}</button>
                <p style={styles.recordButtonText}>{isRecording ? formatTime(recordingTime) : (user ? t.tapToRecord : t.signInToRecord)}</p>
                 <div style={styles.statusContainer} aria-live="polite">{isSaving ? <p>{t.processing}</p> : error ? <p style={styles.errorText}>{error}</p> : null}</div>
            </div>
            <footer style={styles.recordFooter}>
                 <label style={styles.toggleSwitchLabel}><span>{t.keepAwake}</span><div style={styles.toggleSwitch}><input type="checkbox" checked={keepAwake} onChange={() => setKeepAwake(!keepAwake)} /><span className="slider"></span></div></label>
                 {isRecording && <button onClick={onTogglePip} style={styles.secondaryButton}>{t.toggleMiniView}</button>}
            </footer>
        </div>
    );
};

export const SessionsListView = ({ sessions, onSelectSession, searchQuery, setSearchQuery }: { sessions: Session[], onSelectSession: (s: Session) => void, searchQuery: string, setSearchQuery: (q: string) => void }) => {
    const { t } = useLocalization();
    const filtered = sessions.filter((s: Session) => [s.metadata.title, s.results?.summary, s.results?.transcript].some(text => text?.toLowerCase().includes(searchQuery.toLowerCase())));
    return (
        <div style={styles.sessionsView}>
            <div style={styles.sessionsHeader}><h2>{t.recentSessions}</h2><input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={styles.searchInput} /></div>
            {filtered.length > 0 ? <ul style={styles.sessionsList}>{filtered.map((s: Session) => <li key={s.id} style={styles.sessionItem} onClick={() => onSelectSession(s)} role="button" tabIndex={0}><div><strong>{s.metadata.title}</strong><span style={styles.sessionItemDate}>{new Date(s.metadata.date).toLocaleDateString()}</span></div><div style={styles.sessionItemStatus}>{s.status==='processing' && <span style={styles.processingChip}>{t.processing}</span>}{s.status==='error'&&<span style={styles.errorChip}>Error</span>}</div></li>)}</ul> : <div style={styles.welcomeContainer}><h3>{t.welcomeMessage}</h3><p>{t.welcomeSubtext}</p></div>}
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
        const speakerNames = Object.values(speakers || {});
        const cleanTranscript = (results.transcript || '')
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<br\s*\/?>/g, '\n');

        return `# ${metadata.title}\n\n` +
            `**${t.dateLabel}** ${new Date(metadata.date).toLocaleString()}\n` +
            `**${t.meetingLocation}** ${metadata.location}\n\n` +
            `## ${t.summaryHeader}\n\n${results.summary || t.noSummary}\n\n` +
            `## ${t.actionItemsHeader}\n\n${results.actionItems.length > 0 ? results.actionItems.map((item:string) => `- ${item}`).join('\n') : t.noActionItems}\n\n` +
            `## ${t.speakersHeader}\n\n${speakerNames.length > 0 ? speakerNames.map(name => `- ${name}`).join('\n') : ''}\n\n` +
            `## ${t.transcriptHeader}\n\n${cleanTranscript || t.noTranscript}`;
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

    const renderTranscript = () => {
        if (!session.results?.transcript) return t.noTranscript;
        let displayTranscript = Object.entries(session.speakers || {}).reduce((acc, [id, name]) => acc.replace(new RegExp(`<strong>${id}:</strong>`, 'g'), `<strong>${name}:</strong>`), session.results.transcript);
        return <div dangerouslySetInnerHTML={{ __html: marked.parse(displayTranscript) }} />;
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
            <h2>{session.metadata.title}</h2>
            <p style={styles.detailMeta}>{new Date(session.metadata.date).toLocaleString()}</p>
            <p style={styles.detailMeta}>{t.meetingLocation} <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer">{session.metadata.location}</a></p>
            {session.status === 'completed' && session.results ? (
                <div>
                    <Accordion title={t.summaryHeader} defaultOpen><div style={styles.contentBlock} dangerouslySetInnerHTML={{ __html: marked.parse(session.results.summary || t.noSummary) }}></div></Accordion>
                    <Accordion title={t.actionItemsHeader} defaultOpen><ul style={styles.actionItemsList}>{session.results.actionItems.length > 0 ? session.results.actionItems.map((item:string, i:number) => <li key={i} style={styles.actionItem}><span>{item}</span><button style={styles.takeActionButton} onClick={() => onTakeAction(item, session)}>{t.takeAction}</button></li>) : <li>{t.noActionItems}</li>}</ul></Accordion>
                    <Accordion title={t.speakersHeader}><ul style={styles.speakersList}>{Object.entries(session.speakers || {}).map(([id, name]) => <li key={id} style={styles.speakerItem}>{editingSpeaker?.speakerId === id ? <form onSubmit={e => { e.preventDefault(); onUpdateSpeakerName(session.id, id, (e.target as any).speakerName.value); }}><input name="speakerName" type="text" defaultValue={name as string} onBlur={e => onUpdateSpeakerName(session.id, id, e.target.value)} autoFocus style={styles.speakerInput} /></form> : <><span>{name as string}</span><button onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })} style={styles.editSpeakerButton}>✏️</button></>}</li>)}</ul></Accordion>
                    <Accordion title={t.transcriptHeader}><div style={styles.transcriptContainer}>{renderTranscript()}</div></Accordion>
                </div>
            ) : session.status === 'processing' ? <p>{t.processing}</p> : <p style={styles.errorText}>{session.error || t.processingError}</p>}
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
        <div style={{ ...styles.loginView, justifyContent: 'center' }}>
            <p>{prompt}</p>
            {error && <p style={styles.errorText}>{error}</p>}
            <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>
        </div>
    );
};

export const Modal = ({ title, onClose, children }: ModalProps) => <div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContainer} onClick={e => e.stopPropagation()}><div style={styles.modalHeader}><h3>{title}</h3><button style={styles.modalCloseButton} onClick={onClose}>&times;</button></div><div style={styles.modalBody}>{children}</div></div></div>;

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
    return <Modal title={title} onClose={onClose}><p style={styles.sourceItemText}><em>"{sourceItem}"</em></p>{content()}</Modal>;
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
    const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY") && firebaseConfig.projectId && !firebaseConfig.projectId.includes("YOUR_PROJECT_ID");

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
