
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

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

    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            backgroundColor: '#1E1E1E',
            color: 'white',
            fontFamily: "'Poppins', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: '12px 16px',
            borderRadius: '12px',
        },
        statusContainer: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        },
        recordingIndicator: {
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#dc3545',
            animation: 'pulse 2s infinite',
        },
        timer: {
            fontSize: '1.5rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            flexGrow: 1,
            textAlign: 'center',
        },
        stopButton: {
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: 1,
            transition: 'opacity 0.2s',
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.statusContainer}>
                <div style={styles.recordingIndicator}></div>
            </div>
            <div style={styles.timer}>{formatTime(time)}</div>
            <button 
                style={styles.stopButton} 
                onClick={handleStop}
            >
                Stop
            </button>
        </div>
    );
};

const style = document.createElement('style');
style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
    
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
        70% { box-shadow: 0 0 0 8px rgba(220, 53, 69, 0); }
        100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
    }

    body {
        margin: 0;
        overflow: hidden;
        border-radius: 12px;
    }
`;
document.head.appendChild(style);

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<PipApp />);
