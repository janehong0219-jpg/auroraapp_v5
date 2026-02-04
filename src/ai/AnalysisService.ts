import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { UnifiedEmbouchureMetrics } from "./embouchureLogic";
import type { NoteData } from "../utils/noteUtils";

export interface AnalysisLog {
    timestamp: any; // ServerTimestamp
    note: NoteData | null;
    embouchure: UnifiedEmbouchureMetrics | null;
    harmonics: { f1: number; f2: number; f3: number; score: number } | null;
    pitchStability: number | null;
}

export const saveAnalysisLog = async (
    note: NoteData | null,
    embouchure: UnifiedEmbouchureMetrics | null,
    harmonics: { f1: number; f2: number; f3: number; score: number } | null,
    pitchStability: number | null
) => {
    try {
        const logData: AnalysisLog = {
            timestamp: serverTimestamp(),
            note,
            embouchure,
            harmonics,
            pitchStability
        };

        const docRef = await addDoc(collection(db, "analysis_logs"), logData);
        console.log("Analysis saved with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};
