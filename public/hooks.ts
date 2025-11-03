

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

export const useKeepAwake = () => {
    const wakeLockRef = useRef<any>(null);
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            } catch (err: any) { console.error(`Wake Lock failed: ${err.name}, ${err.message}`); }
        }
    }, []);
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
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
        // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signIn = async () => {
        // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
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

    // @google/genai Coding Guidelines: Fix Firebase auth function calls to use v8 compat syntax.
    const signOutUser = () => auth.signOut();
    
    return { user, loading, signIn, signOut: signOutUser };
};

export const usePictureInPicture = () => {
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

// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
export const useSessions = (user: firebase.User | null) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const { t } = useLocalization();

    useEffect(() => {
        if (!user) {
            setSessions([]);
            setSessionsLoading(false);
            return;
        }
        setSessionsLoading(true);
        // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
        const q = db.collection(`users/${user.uid}/sessions`).orderBy('metadata.date', 'desc');
        const unsubscribe = q.onSnapshot((snapshot) => {
            const userSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(userSessions);
            setSessionsLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setSessionsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    const deleteSession = async (sessionId: string) => {
        if (!user) return;
        if (window.confirm(t.deleteConfirmation)) {
            try {
                // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                await db.doc(`users/${user.uid}/sessions/${sessionId}`).delete();
                // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                const storageRef = storage.ref(`recordings/${user.uid}/${sessionId}.webm`);
                await storageRef.delete();
                return true;
            } catch (error) {
                console.error("Error deleting session:", error);
                return false;
            }
        }
        return false;
    };
    
    const updateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user) return;
        // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
        const sessionDocRef = db.doc(`users/${user.uid}/sessions/${sessionId}`);
        await sessionDocRef.update({ [`speakers.${speakerId}`]: newName });
    };

    return { sessions, sessionsLoading, deleteSession, updateSpeakerName };
};


// @google/genai Coding Guidelines: Fix 'User' type not found error by using firebase.User from the compat library.
export const useRecorder = (user: firebase.User | null) => {
    const { t } = useLocalization();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [status, setStatus] = useState('');
    const [isMicReady, setIsMicReady] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };
    
    const startRecording = async () => {
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
                if(timerRef.current) clearInterval(timerRef.current);
                
                if (audioChunksRef.current.length === 0 || recordingTime < 2) {
                    setStatus(t.recordingTooShortError);
                    setTimeout(() => setStatus(''), 3000);
                    audioChunksRef.current = [];
                    return;
                }
                
                setStatus(t.analyzing);
                
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                
                // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                const newSessionDoc = db.collection(`users/${user.uid}/sessions`).doc();
                const sessionId = newSessionDoc.id;
                // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                const storageRef = storage.ref(`recordings/${user.uid}/${sessionId}.webm`);
                
                try {
                    // @google/genai Coding Guidelines: Fix Storage function calls to use v8 compat syntax.
                    await storageRef.put(audioBlob);
                    
                    const newSession: Omit<Session, 'id'> = {
                        metadata: { title: `Session ${new Date().toLocaleString()}`, date: new Date().toISOString(), location: '', mapUrl: '' },
                        results: { transcript: '', summary: '', actionItems: [] },
                        speakers: {},
                        status: 'processing'
                    };
                    // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                    await newSessionDoc.set(newSession);
                    
                    // @google/genai Coding Guidelines: Fix Functions function calls to use v8 compat syntax.
                    const analyzeAudio = functions.httpsCallable('analyzeAudio');
                    await analyzeAudio({ sessionId, prompt: t.analysisPrompt });

                } catch (error) {
                    console.error("Error during upload/analysis:", error);
                    setStatus(t.processingError);
                    // @google/genai Coding Guidelines: Fix Firestore function calls to use v8 compat syntax.
                    await newSessionDoc.update({ status: 'error', error: 'Upload or function call failed.' });
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
    
    return { isRecording, recordingTime, status, isMicReady, startRecording, stopRecording };
};