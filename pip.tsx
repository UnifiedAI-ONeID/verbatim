
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const PIP_STYLES: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    fontFamily: 'monospace',
    backgroundColor: '#1E1E1E',
    color: '#E0E0E0',
    borderRadius: '8px',
    margin: '4px',
    height: 'calc(100vh - 8px)',
};

const BUTTON_STYLES: React.CSSProperties = {
    backgroundColor: '#CF6679',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '24px',
};

const TIMER_STYLES: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
};

const PiPWindow = () => {
    const [time, setTime] = useState(0);
    const channel = useRef(new BroadcastChannel('verbatim_pip_channel'));

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'time_update') {
                setTime(event.data.time);
            }
        };

        const currentChannel = channel.current;
        currentChannel.addEventListener('message', handleMessage);

        // Notify the main window that the PiP window is ready
        currentChannel.postMessage({ type: 'pip_ready' });

        return () => {
            currentChannel.removeEventListener('message', handleMessage);
        };
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const handleStop = () => {
        channel.current.postMessage({ type: 'stop_recording' });
        window.close();
    };

    return (
        <div style={PIP_STYLES}>
            <span style={TIMER_STYLES}>{formatTime(time)}</span>
            <button style={BUTTON_STYLES} onClick={handleStop}>
                ⏹️
            </button>
        </div>
    );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<PiPWindow />);
