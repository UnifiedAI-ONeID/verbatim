import { CSSProperties } from 'react';

// --- STYLES (using CSS variables) ---
export const styles: { [key: string]: CSSProperties } = {
    // --- App & Layout ---
    appContainer: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--bg)', boxSizing: 'border-box' },
    mainContent: { flex: 1, overflowY: 'auto', paddingBottom: '80px', display: 'flex', flexDirection: 'column', position: 'relative', width: '100%' },
    loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' },
    
    // --- Header ---
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg)', zIndex: 100 },
    headerControls: { display: 'flex', alignItems: 'center', gap: '8px' },
    logo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 'bold', cursor: 'pointer' },
    logoIcon: { width: '32px', height: '32px', borderRadius: '8px' },
    logoText: { color: 'var(--accent-primary)', display: 'block' },
    themeToggleButton: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' },
    headerSelect: { backgroundColor: 'var(--bg-2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.9rem' },
    
    // --- Bottom Navigation ---
    bottomNav: { display: 'flex', justifyContent: 'space-around', backgroundColor: 'var(--bg-2)', padding: '5px 0', borderTop: '1px solid var(--border-color)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, height: '65px' },
    navButton: { background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1rem', padding: '12px 20px', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', margin: '0 5px', transition: 'background-color 0.2s ease, color 0.2s ease' },
    navButtonActive: { color: 'var(--accent-primary)', fontWeight: 'bold', backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' },

    // --- Record View ---
    recordView: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '24px 16px', boxSizing: 'border-box' },
    recordButtonContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, textAlign: 'center', width: '100%', position: 'relative' },
    recordButton: { width: '180px', height: '180px', borderRadius: '50%', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-text)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 25px color-mix(in srgb, var(--accent-primary) 30%, transparent), 0 2px 10px rgba(0,0,0,0.2)' },
    recordButtonRecording: { backgroundColor: 'var(--danger)', color: '#FFFFFF', boxShadow: '0 0 30px color-mix(in srgb, var(--danger) 50%, transparent)', animation: 'pulse 1.5s infinite' },
    recordButtonDisabled: { backgroundColor: 'var(--bg-3)', color: 'var(--text-tertiary)', cursor: 'not-allowed', boxShadow: 'none' },
    recordButtonText: { marginTop: '24px', fontSize: '1.25rem', color: 'var(--text-secondary)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, transition: 'all 0.3s ease' },
    timerText: { marginTop: '24px', fontSize: '2.5rem', color: 'var(--text-primary)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontFamily: 'monospace, "Courier New", Courier', letterSpacing: '2px', transition: 'all 0.3s ease' },
    recordFooter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', paddingBottom: '10px' },
    visualizerCanvas: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' },

    // --- Sessions View ---
    sessionsView: { padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' },
    sessionsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' },
    sessionsHeaderTitle: { margin: 0, fontSize: '1.75rem' },
    searchInput: { backgroundColor: 'var(--bg-2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '10px', padding: '10px 14px', fontSize: '1rem', width: '100%', flex: 1, maxWidth: '300px' },
    sessionsList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
    sessionItemButton: { background: 'var(--bg-2)', padding: '16px 20px', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', width: '100%', textAlign: 'left', color: 'var(--text-primary)' },
    sessionItemInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
    sessionItemTitle: { fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' },
    sessionItemDate: { fontSize: '0.9rem', color: 'var(--text-secondary)' },
    sessionItemStatus: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-tertiary)' },
    processingChip: { backgroundColor: 'var(--bg-3)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '12px', fontSize: '0.8rem' },
    errorChip: { backgroundColor: 'var(--danger-bg-light)', color: 'var(--danger-text)', padding: '5px 10px', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid var(--danger-border)' },
    welcomeContainer: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' },

    // --- Skeleton Loading ---
    skeleton: { backgroundColor: 'var(--bg-3)', borderRadius: '12px', position: 'relative', overflow: 'hidden' },
    skeletonShine: { position: 'absolute', top: 0, left: '-150%', width: '150%', height: '100%', background: 'linear-gradient(90deg, transparent, var(--bg-2), transparent)', animation: 'shine 1.5s infinite' },

    // --- Detail View ---
    detailView: { padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' },
    detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
    detailHeaderActions: { display: 'flex', alignItems: 'center', gap: '10px' },
    detailTitle: { margin: '0 0 4px 0', fontSize: '1.75rem' },
    detailMeta: { color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    detailMetaLocationLink: { color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px', display: 'inline-block', verticalAlign: 'bottom' },
    contentBlock: { whiteSpace: 'pre-wrap', lineHeight: 1.7 },
    actionItemsList: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
    actionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' },
    takeActionButton: { background: 'var(--accent-primary)', color: 'var(--accent-primary-text)', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginLeft: '12px', whiteSpace: 'nowrap' },
    speakersList: { listStyle: 'none', padding: 0 },
    speakerItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' },
    editSpeakerButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '8px', borderRadius: '50%' },
    speakerInput: { backgroundColor: 'var(--bg-3)', color: 'var(--text-primary)', border: '1px solid var(--border-color-2)', borderRadius: '6px', padding: '6px 10px', flexGrow: 1 },
    transcriptContainer: { backgroundColor: 'var(--bg-2)', padding: '15px', borderRadius: '12px', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7, border: '1px solid var(--border-color)' },
    exportMenu: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, backgroundColor: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden', minWidth: '180px' },
    exportMenuItem: { background: 'none', border: 'none', color: 'var(--text-primary)', padding: '12px 20px', display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' },
    
    // --- Accordion ---
    accordionContainer: { marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' },
    accordionHeader: { backgroundColor: 'var(--bg-accent)', padding: '16px', cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    accordionContent: { padding: '16px', backgroundColor: 'var(--bg-2)' },

    // --- Modal ---
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '16px' },
    modalContainer: { backgroundColor: 'var(--bg-2)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 5px 20px rgba(0,0,0,0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' },
    modalTitle: { margin: 0, fontSize: '1.25rem' },
    modalCloseButton: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.8rem', cursor: 'pointer', padding: 0, lineHeight: 1 },
    modalBody: { overflowY: 'auto' },
    deviceList: { listStyle: 'none', padding: 0, margin: '10px 0 0' },
    deviceItem: { padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '10px', cursor: 'pointer', textAlign: 'center', backgroundColor: 'var(--bg-3)', transition: 'background-color 0.2s, border-color 0.2s' },

    // --- Action Modal Specifics ---
    actionButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '16px', padding: '12px 20px', backgroundColor: 'var(--bg-3)', color: 'var(--text-primary)', textDecoration: 'none', borderRadius: '10px', fontWeight: 'bold', border: '1px solid var(--border-color)', transition: 'background-color 0.2s' },
    preformattedText: { whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-3)', padding: '12px', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)' },
    sourceItemText: { color: 'var(--text-secondary)', borderLeft: '4px solid var(--accent-primary)', paddingLeft: '12px', marginBottom: '16px', fontStyle: 'italic' },
    calendarButtonsContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
    calendarIcon: { width: '24px', height: '24px', marginRight: '12px' },

    // --- Generic & Utility ---
    primaryButton: { backgroundColor: 'var(--accent-secondary)', color: 'var(--accent-secondary-text)', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', minHeight: '44px' },
    secondaryButton: { background: 'var(--bg-3)', border: '1px solid var(--border-color-2)', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', minHeight: '44px' },
    backButton: { background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '1rem', cursor: 'pointer', padding: '8px 0' },
    deleteButton: { background: 'var(--danger-bg-light)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem', minHeight: '44px' },
    errorText: { color: 'var(--danger)', backgroundColor: 'var(--danger-bg-light)', padding: '10px', borderRadius: '8px', border: '1px solid var(--danger-border)' },
    loginView: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', gap: '24px' },
    loginViewIcon: { width: '80px', height: '80px' },
    loginViewTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 600 },
    loginViewText: { margin: 0, color: 'var(--text-secondary)' },

    // --- Toggle Switch ---
    toggleSwitchLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '1rem', width: '100%', maxWidth: '350px', padding: '12px 16px', backgroundColor: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--border-color)' },
    toggleSwitch: { position: 'relative', display: 'inline-block', width: '50px', height: '28px' },

    // --- Toast Notification ---
    toastContainer: { position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-3)', color: 'var(--text-primary)', padding: '12px 24px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3000, animation: 'toast-fade-in 0.3s ease-out forwards, toast-fade-out 0.3s ease-in 2.7s forwards' },

    // --- Dedication / Config Warning ---
    dedicationOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, overflow: 'hidden' },
    confettiContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
    dedicationModal: { padding: '30px', borderRadius: '12px', textAlign: 'center', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
    dedicationText: { fontSize: '1.5rem', fontWeight: 'bold', margin: 0 },
    configWarningOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, color: '#fff', textAlign: 'left', fontFamily: 'sans-serif' },
    configWarningBox: { backgroundColor: '#2a2a2a', padding: '20px 40px', borderRadius: '12px', width: '90%', maxWidth: '600px', border: '1px solid var(--border-color)', fontFamily: "'Poppins', sans-serif" },
};

export function injectGlobalStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { -webkit-tap-highlight-color: transparent; }

*:focus-visible {
  outline: 2px solid var(--accent-secondary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Responsive styles for desktop */
@media (min-width: 768px) {
    #root {
        display: flex;
        justify-content: center;
    }
    .app-container > main {
        max-width: 900px;
        margin: 0 auto;
        border-left: 1px solid var(--border-color);
        border-right: 1px solid var(--border-color);
        box-shadow: 0 0 40px color-mix(in srgb, var(--text-primary) 5%, transparent);
    }
    .app-container > header, .app-container > nav {
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
    }
     .app-container > nav {
        position: sticky;
        border-right: 1px solid var(--border-color);
        border-left: 1px solid var(--border-color);
     }
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 
  0% { transform: scale(0.98); box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 70%, transparent); } 
  70% { transform: scale(1); box-shadow: 0 0 0 25px color-mix(in srgb, var(--danger) 0%, transparent); } 
  100% { transform: scale(0.98); box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 0%, transparent); } 
}
@keyframes mic-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.mic-icon {
  animation: mic-pulse 2.5s ease-in-out infinite;
  transform-origin: center;
}
@keyframes view-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes toast-fade-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes toast-fade-out { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, 10px); } }
@keyframes shine { to { left: 150%; } }

.slider { 
  position: absolute; cursor: pointer; inset: 0; background-color: var(--bg-3); transition: .4s; border-radius: 28px; 
} 
.slider:before { 
  position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; 
} 
input { opacity: 0; width: 0; height: 0; } 
input:checked + .slider { background-color: var(--accent-primary); } 
input:checked + .slider:before { transform: translateX(22px); }

@keyframes confetti-fall { 
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } 
}
.confetti-piece { 
  position: absolute; width: 8px; height: 16px; opacity: 0;
  animation: confetti-fall 7s linear infinite; 
}
`;
    document.head.appendChild(styleSheet);
}