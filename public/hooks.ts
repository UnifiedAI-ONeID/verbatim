
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// @google/genai Coding Guidelines: Fix Firebase v9 modular syntax errors by switching to v8 compat libraries.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/functions';

import { auth, db, storage, functions } from './services.ts';
import { useLocalization } from './contexts.tsx';
import { Session } from './types.ts';

/**
 * Fetches the user's current location using the browser's Geolocation API
 * and performs a reverse geocoding lookup to get a human-readable address.
 * @returns {Promise<{location: string, mapUrl: string}>} A promise that resolves to an object containing the location string and a URL to view it on a map.
 */
const getCurrentLocation = async (): Promise<{ location: string; mapUrl: string; }> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn('[Location] Geolocation is not supported by this browser.');
            resolve({ location: 'N/A', mapUrl: '' });
            return;
        }
        // Attempt to get the current position with a timeout and caching to be efficient.
        console.debug('[Location] Requesting current position...');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                console.info(`[Location] Position found: ${latitude}, ${longitude}`);
                try {
                    // Use OpenStreetMap's free Nominatim service for reverse geocoding.
                    console.debug('[Location] Fetching address from Nominatim...');
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    if (!response.ok) throw new Error(`Reverse geocoding failed with status ${response.status}`);
                    const data = await response.json();
                    const location = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
                    console.info(`[Location] Address found: ${location}`);
                    resolve({ location, mapUrl });
                } catch (error) {
                    console.error("[Location] Reverse geocoding API error:", error);
                    // Fallback to coordinates if the API call fails
                    resolve({ location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, mapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}` });
                }
            },
            (error) => {
                console.warn("[Location] Geolocation permission denied or failed:", error.message);
                resolve({ location: 'Permission Denied', mapUrl: '' });
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
    });
};


export const useKeepAwake = () => {
    const wakeLockRef = useRef<any>(null);
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.info('[WakeLock] Screen wake lock acquired.');
            } catch (err: any) { console.error(`[WakeLock] Failed to acquire wake lock: ${err.name}, ${err.message}`); }
        }
    }, []);
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
            console.info('[WakeLock] Screen wake lock released.');
        }
    }, []);
    return { requestWakeLock, releaseWakeLock };
};

export const useAuth = () => {
    const { t } = useLocalization();
    // @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
    const [user, setUser] = useState<firebase.User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.debug('[Auth] Subscribing to auth state changes.');
        // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            console.info(`[Auth] State changed. User: ${currentUser ? currentUser.uid : 'null'}`);
            setUser(currentUser);
            setLoading(false);
        });
        return () => {
            console.debug('[Auth] Unsubscribing from auth state changes.');
            unsubscribe();
        }
    }, []);

    const signIn = async () => {
        // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            console.info('[Auth] Attempting Google sign-in with popup...');
            // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
            const result = await auth.signInWithPopup(provider);
            console.info(`[Auth] Sign-in successful for user: ${result.user?.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/popup-blocked') {
                console.warn('[Auth] Sign-in popup was blocked by the browser.');
                alert(t.signInPopupBlockedError);
            } else {
                console.error("[Auth] Sign-in error:", error);
                alert(t.signInError);
            }
        }
    };

    // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
    const signOutUser = () => {
        console.info('[Auth] Signing out user...');
        auth.signOut().then(() => {
            console.info('[Auth] Sign-out successful.');
        });
    }
    
    return { user, loading, signIn, signOut: signOutUser };
};

export const usePictureInPicture = () => {
    const pipWindow = useRef<Window | null>(null);
    const [isPipOpen, setIsPipOpen] = useState(false);
    const channel = useMemo(() => new BroadcastChannel('verbatim_pip_channel'), []);

    const requestPip = useCallback(async () => {
        if ((document as any).pictureInPictureEnabled && !pipWindow.current) {
            try {
                console.info('[PiP] Requesting Picture-in-Picture window.');
                pipWindow.current = await (window as any).open('/pip.html', 'VerbatimPIP', 'width=400,height=80,popup');
                setIsPipOpen(true);
                 if (pipWindow.current) {
                    pipWindow.current.addEventListener('beforeunload', () => {
                        console.info('[PiP] Picture-in-Picture window closed.');
                        setIsPipOpen(false);
                        pipWindow.current = null;
                    });
                }
            } catch (error) {
                console.error('[PiP] Error opening PiP window:', error);
            }
        } else {
            console.warn('[PiP] PiP not supported or already open.');
        }
    }, []);
    
    const closePip = useCallback(() => {
        if (pipWindow.current) {
            console.info('[PiP] Closing Picture-in-Picture window programmatically.');
            pipWindow.current.close();
            pipWindow.current = null;
            setIsPipOpen(false);
        }
    }, []);
    
     useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data.type === 'pip_ready') {
                console.debug('[PiP] PiP window is ready.');
            }
        };
        channel.addEventListener('message', handler);
        return () => channel.removeEventListener('message', handler);
    }, [channel]);

    const updatePip = useCallback((isRecording: boolean, recordingTime: number) => {
        if (isPipOpen) {
            channel.postMessage({ type: 'state_update', isRecording, recordingTime });
        }
    }, [isPipOpen, channel]);

    return { requestPip, closePip, updatePip, isPipOpen };
};

// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
export const useSessions = (user: firebase.User | null) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const { t } = useLocalization();

    useEffect(() => {
        if (!user) {
            console.debug('[Sessions] No user, clearing sessions list.');
            setSessions([]);
            setSessionsLoading(false);
            return;
        }
        setSessionsLoading(true);
        console.info(`[Sessions] Subscribing to session updates for user: ${user.uid}`);
        // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
        const q = db.collection(`users/${user.uid}/sessions`).orderBy('metadata.date', 'desc');
        const unsubscribe = q.onSnapshot((snapshot) => {
            const userSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            console.info(`[Sessions] Snapshot received. ${userSessions.length} sessions loaded.`);
            setSessions(userSessions);
            setSessionsLoading(false);
        }, (error) => {
            console.error("[Sessions] Error fetching sessions:", error);
            setSessionsLoading(false);
        });

        return () => {
            console.info(`[Sessions] Unsubscribing from session updates for user: ${user.uid}`);
            unsubscribe();
        }
    }, [user]);
    
    const deleteSession = async (sessionId: string) => {
        if (!user) {
            console.warn('[Sessions] Delete failed: No user authenticated.');
            return false;
        }
        if (window.confirm(t.deleteConfirmation)) {
            console.info(`[Sessions] Attempting to delete session: ${sessionId}`);
            try {
                // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                await db.doc(`users/${user.uid}/sessions/${sessionId}`).delete();
                console.debug(`[Sessions] Firestore document deleted: ${sessionId}`);
                // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                const storageRef = storage.ref(`recordings/${user.uid}/${sessionId}.webm`);
                await storageRef.delete();
                console.debug(`[Sessions] Storage file deleted: ${sessionId}.webm`);
                console.info(`[Sessions] Session deleted successfully: ${sessionId}`);
                return true;
            } catch (error) {
                console.error(`[Sessions] Error deleting session ${sessionId}:`, error);
                return false;
            }
        }
        console.debug('[Sessions] Delete cancelled by user.');
        return false;
    };
    
    const updateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user) {
            console.warn('[Sessions] Update speaker failed: No user authenticated.');
            return;
        }
        console.info(`[Sessions] Updating speaker name for session: ${sessionId}, speaker: ${speakerId} to "${newName}"`);
        // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
        const sessionDocRef = db.doc(`users/${user.uid}/sessions/${sessionId}`);
        await sessionDocRef.update({ [`speakers.${speakerId}`]: newName })
            .then(() => console.info('[Sessions] Speaker name updated successfully.'))
            .catch(error => console.error('[Sessions] Error updating speaker name:', error));
    };

    return { sessions, sessionsLoading, deleteSession, updateSpeakerName };
};


// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
export const useRecorder = (user: firebase.User | null) => {
    const { t } = useLocalization();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [status, setStatus] = useState('');
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            console.info('[Recorder] Stopping recording via stopRecording().');
            mediaRecorderRef.current.stop();
        } else {
             console.warn('[Recorder] stopRecording() called but no active recording.');
        }
    };
    
    const startRecording = async () => {
        if (!user) {
            console.warn('[Recorder] Start recording blocked: No user authenticated.');
            return;
        }
        console.info('[Recorder] Starting recording process...');
        setStatus(t.preparing);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            console.debug('[Recorder] Microphone stream acquired.');

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const newAnalyser = audioContext.createAnalyser();
            newAnalyser.fftSize = 256;
            source.connect(newAnalyser);
            setAnalyser(newAnalyser);
            console.debug('[Recorder] Audio analyser node created.');

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                console.info(`[Recorder] Recording stopped. Duration: ${recordingTime}s. Chunks: ${audioChunksRef.current.length}`);
                streamRef.current?.getTracks().forEach(track => track.stop());
                audioContextRef.current?.close();
                setAnalyser(null);
                setIsRecording(false);
                if(timerRef.current) clearInterval(timerRef.current);
                
                if (audioChunksRef.current.length === 0 || recordingTime < 2) {
                    console.warn('[Recorder] Recording too short or no data. Aborting analysis.');
                    setStatus(t.recordingTooShortError);
                    setTimeout(() => setStatus(''), 3000);
                    audioChunksRef.current = [];
                    return;
                }
                
                setStatus(t.analyzing);
                
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                console.info(`[Recorder] Audio blob created. Size: ${audioBlob.size} bytes.`);
                
                // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                const newSessionDoc = db.collection(`users/${user.uid}/sessions`).doc();
                const sessionId = newSessionDoc.id;
                // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                const storageRef = storage.ref(`recordings/${user.uid}/${sessionId}.webm`);
                
                const locationData = await getCurrentLocation();
                
                try {
                    console.info(`[Recorder] Uploading audio for session ${sessionId} to Firebase Storage...`);
                    // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                    await storageRef.put(audioBlob);
                    console.info(`[Recorder] Upload complete for session ${sessionId}.`);
                    
                    const newSession: Omit<Session, 'id'> = {
                        metadata: { 
                            title: `Session ${new Date().toLocaleString()}`, 
                            date: new Date().toISOString(), 
                            location: locationData.location,
                            mapUrl: locationData.mapUrl
                        },
                        results: { transcript: '', summary: '', actionItems: [] },
                        speakers: {},
                        status: 'processing'
                    };
                    console.info(`[Recorder] Creating Firestore document for session ${sessionId}...`);
                    // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                    await newSessionDoc.set(newSession);
                    console.info(`[Recorder] Firestore document created. Calling analyzeAudio function for session ${sessionId}.`);
                    
                    // @google/genai Coding Guidelines: Fix Functions function calls to use v8 compat syntax.
                    const analyzeAudio = functions.httpsCallable('analyzeAudio');
                    await analyzeAudio({ sessionId, prompt: t.analysisPrompt });
                    console.info(`[Recorder] analyzeAudio function call initiated for session ${sessionId}.`);
                    setStatus('');
                } catch (error) {
                    console.error(`[Recorder] Error during upload/analysis for session ${sessionId}:`, error);
                    setStatus(t.processingError);
                    // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                    await newSessionDoc.update({ status: 'error', error: 'Upload or function call failed.' });
                }
            };

            mediaRecorder.start(1000); // Collect data in 1s chunks
            setIsRecording(true);
            setStatus('');
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            console.info('[Recorder] MediaRecorder started.');
            
        } catch (err) {
            console.error('[Recorder] Error starting recording:', err);
            setStatus(t.micPermissionError);
        }
    };
    
    return { isRecording, recordingTime, status, analyser, startRecording, stopRecording };
};