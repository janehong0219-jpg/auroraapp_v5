import { db } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

export interface PracticeSong {
    name: string;
    genre?: string;
    difficulty?: string;
}

export interface PracticeLogData {
    checkedIn: boolean;
    songs: PracticeSong[];
    notes: string;
    timestamp: number;
    toneQuality?: {
        overall: number;
        brightness: number;
        richness: number;
        balance: number;
        count: number; // Number of measurements
    };
}

const COLLECTION_NAME = 'practiceLogs';
const USER_ID = 'default'; // For future multi-user support

function getDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function checkIn(date: Date = new Date(), toneQuality?: { overall: number; brightness: number; richness: number; balance: number }): Promise<void> {
    const dateKey = getDateKey(date);
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() as PracticeLogData : null;

    // Merge tone quality if provided
    let updatedToneQuality = existingData?.toneQuality;
    if (toneQuality) {
        if (updatedToneQuality) {
            // Average with existing data
            const count = updatedToneQuality.count + 1;
            updatedToneQuality = {
                overall: (updatedToneQuality.overall * updatedToneQuality.count + toneQuality.overall) / count,
                brightness: (updatedToneQuality.brightness * updatedToneQuality.count + toneQuality.brightness) / count,
                richness: (updatedToneQuality.richness * updatedToneQuality.count + toneQuality.richness) / count,
                balance: (updatedToneQuality.balance * updatedToneQuality.count + toneQuality.balance) / count,
                count
            };
        } else {
            updatedToneQuality = { ...toneQuality, count: 1 };
        }
    }

    await setDoc(docRef, {
        checkedIn: true,
        songs: existingData?.songs || [],
        notes: existingData?.notes || '',
        toneQuality: updatedToneQuality,
        timestamp: Date.now()
    });
}

export async function addSong(songData: PracticeSong, date: Date = new Date()): Promise<void> {
    const dateKey = getDateKey(date);
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() as PracticeLogData : null;

    const songs = existingData?.songs || [];
    songs.push(songData);

    await setDoc(docRef, {
        checkedIn: existingData?.checkedIn || false,
        songs,
        notes: existingData?.notes || '',
        timestamp: Date.now()
    });
}

export async function removeSong(songIndex: number, date: Date = new Date()): Promise<void> {
    const dateKey = getDateKey(date);
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists()) return;

    const existingData = existingDoc.data() as PracticeLogData;
    const songs = existingData.songs.filter((_, index) => index !== songIndex);

    await setDoc(docRef, {
        ...existingData,
        songs,
        timestamp: Date.now()
    });
}

export async function updateNotes(noteText: string, date: Date = new Date()): Promise<void> {
    const dateKey = getDateKey(date);
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() as PracticeLogData : null;

    await setDoc(docRef, {
        checkedIn: existingData?.checkedIn || false,
        songs: existingData?.songs || [],
        notes: noteText,
        timestamp: Date.now()
    });
}

export async function getTodayLog(): Promise<PracticeLogData | null> {
    const dateKey = getDateKey(new Date());
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as PracticeLogData;
    }
    return null;
}

export async function getLogByDate(date: Date): Promise<PracticeLogData | null> {
    const dateKey = getDateKey(date);
    const docRef = doc(db, COLLECTION_NAME, USER_ID, 'logs', dateKey);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as PracticeLogData;
    }
    return null;
}

export async function getPracticeLogs(days: number = 30): Promise<Map<string, PracticeLogData>> {
    const logsMap = new Map<string, PracticeLogData>();
    const logsRef = collection(db, COLLECTION_NAME, USER_ID, 'logs');

    try {
        const q = query(logsRef, orderBy('timestamp', 'desc'), limit(days));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            logsMap.set(doc.id, doc.data() as PracticeLogData);
        });
    } catch (error) {
        console.error('Error fetching practice logs:', error);
    }

    return logsMap;
}

export async function getPracticeStreak(): Promise<number> {
    const logsMap = await getPracticeLogs(365);
    let streak = 0;

    // Start from today and count backwards
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateKey = getDateKey(checkDate);

        const log = logsMap.get(dateKey);
        if (log && log.checkedIn) {
            streak++;
        } else {
            break; // Streak is broken
        }
    }

    return streak;
}
