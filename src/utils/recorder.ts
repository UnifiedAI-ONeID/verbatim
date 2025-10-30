
import { auth, db } from '../firebase';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const channel = new BroadcastChannel('verbatim_pip_channel');
const storage = getStorage();

let recorder: MediaRecorder | null = null;
let recordingInterval: number | null = null;
let recordingStartTime: number | null = null;

const upload = async (blob: Blob, sessionId: string, uid: string) => {
    const sessionRef = doc(db, `users/${uid}/sessions/${sessionId}`);
    const storageRef = ref(storage, `recordings/${uid}/${sessionId}.webm`);

    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            updateDoc(sessionRef, { uploadProgress: progress, status: 'uploading' });
        },
        (error) => {
            console.error("Upload failed:", error);
            updateDoc(sessionRef, { status: 'error', error: 'Upload failed' });
        },
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            updateDoc(sessionRef, {
                status: 'uploaded',
                recordingUrl: downloadURL,
                uploadProgress: 100,
            });
            console.log("Upload complete, file available at", downloadURL);
        }
    );
};


export const startRecording = async () => {
    if (!auth.currentUser) {
        alert("Please log in to start a new session.");
        return;
    }
    const uid = auth.currentUser.uid;

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "browser",
            },
            audio: {
                suppressLocalAudioPlayback: false,
            },
            preferCurrentTab: true,
        });

        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const combinedStream = new MediaStream([...stream.getTracks(), ...audioStream.getTracks()]);


        const sessionRef = await addDoc(collection(db, `users/${uid}/sessions`), {
            createdAt: serverTimestamp(),
            status: 'recording',
        });
        const sessionId = sessionRef.id;


        const recordedChunks: Blob[] = [];
        recorder = new MediaRecorder(combinedStream, { mimeType: 'audio/webm' });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        recorder.onstop = async () => {
            if (recordingInterval) {
                clearInterval(recordingInterval);
                recordingInterval = null;
            }
            channel.postMessage({ type: 'state_update', isRecording: false, recordingTime: 0 });
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            await upload(blob, sessionId, uid);

            combinedStream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        recordingStartTime = Date.now();
        channel.postMessage({ type: 'state_update', isRecording: true, recordingTime: 0 });

        recordingInterval = setInterval(() => {
            if (recordingStartTime) {
                const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
                channel.postMessage({ type: 'state_update', recordingTime: elapsedSeconds });
            }
        }, 1000);

        stream.getVideoTracks()[0].onended = () => {
             if (recorder && recorder.state === 'recording') {
                recorder.stop();
            }
        }

    } catch (error) {
        console.error("Error starting recording:", error);
        alert("Could not start recording. Please ensure you have given the necessary permissions.");
    }
};

channel.addEventListener('message', async (event: MessageEvent) => {
    if (event.data.type === 'stop_recording') {
        if (recorder && recorder.state === 'recording') {
            recorder.stop();
        }
    }
});
