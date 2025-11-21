
import { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { app } from './firebase';
import { User } from 'firebase/auth';
import { Session } from './types';

const db = getFirestore(app);

export function useSessions(user: User | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, `users/${user.uid}/sessions`), (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
      setSessions(sessionsData);
      setSessionsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const deleteSession = async (sessionId: string) => {
    if (!user) return false;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/sessions`, sessionId));
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  };

  const updateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
    if (!user) return;
    try {
      const sessionRef = doc(db, `users/${user.uid}/sessions`, sessionId);
      await updateDoc(sessionRef, {
        [`speakers.${speakerId}`]: newName
      });
    } catch (error) {
      console.error('Error updating speaker name:', error);
    }
  };

  return { sessions, sessionsLoading, deleteSession, updateSpeakerName };
}
