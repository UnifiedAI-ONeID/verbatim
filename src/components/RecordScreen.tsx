
import React from 'react';

// --- i18n Translations ---
// Note: You might want to pass 't' as a prop or use a context provider
const t = {
    recording: 'Recording...',
    tapToRecord: 'Tap to start recording',
    keepAwake: 'Keep Screen Awake',
    toggleMiniView: 'Picture-in-Picture',
    signIn: 'Sign In with Google',
    install: 'Install App',
};

export const RecordScreen = ({ user, isRecording, recordingTime, onStart, onStop, keepAwake, onKeepAwakeChange, onSignIn, onTogglePiP, onInstall, showInstallButton }: any) => {
    const formatTime = (s: number) => (Math.floor(s/60).toString().padStart(2,'0') + ":" + (s%60).toString().padStart(2,'0'));
    
    return (
        <div className="record-screen">
            {user ? (
                <div className={"record-screen-content " + (isRecording ? 'is-recording' : '')}>
                    <p className="record-status-text">{isRecording ? t.recording : t.tapToRecord}</p>
                    <div className="timer-display">{formatTime(recordingTime)}</div>
                    <button onClick={isRecording ? onStop : onStart} className={"mic-button " + (isRecording ? 'stop' : 'start')} />
                    <div className="record-screen-options">
                        {!isRecording && (
                            <div className="keep-awake-container">
                                <label className="keep-awake-label-container">
                                    <span className="keep-awake-label">{t.keepAwake}</span>
                                    <div className="switch"><input type="checkbox" checked={keepAwake} onChange={e => onKeepAwakeChange(e.target.checked)} /><span className="slider round"></span></div>
                                </label>
                            </div>
                        )}
                        {isRecording && <button onClick={onTogglePiP} className="pip-button">{t.toggleMiniView}</button>}
                        {showInstallButton && <button onClick={onInstall} className="install-button">{t.install}</button>}
                    </div>
                </div>
            ) : ( <button onClick={onSignIn} className="modal-button">{t.signIn}</button> )}
        </div>
    );
};
