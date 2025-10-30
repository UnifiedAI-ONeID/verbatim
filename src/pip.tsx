
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const channel = new BroadcastChannel('verbatim_pip_channel');

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const PipApp = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [time, setTime] = useState(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, isRecording: newIsRecording, recordingTime } = event.data;
            if (type === 'state_update') {
                if (newIsRecording !== undefined) setIsRecording(newIsRecording);
                if (recordingTime !== undefined) setTime(recordingTime);
            }
        };

        channel.addEventListener('message', handleMessage);
        channel.postMessage({ type: 'pip_ready' });

        return () => channel.removeEventListener('message', handleMessage);
    }, []);

    const handleStop = () => {
        channel.postMessage({ type: 'stop_recording' });
    };

    return (
        <div className="pip-container">
            <div className="status-container">
                {isRecording ? <div className="recording-indicator"></div> : <div className="not-recording-indicator"></div>}
            </div>
            <div className="timer">{formatTime(time)}</div>
            <button 
                className="stop-button"
                onClick={handleStop} 
                disabled={!isRecording}
            >
                Stop
            </button>
        </div>
    );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<PipApp />);
