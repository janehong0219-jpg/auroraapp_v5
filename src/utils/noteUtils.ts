export interface NoteData {
    note: string;
    frequency: number;
    cents: number;
    deviation: number;
}

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function getNoteFromFrequency(frequency: number): NoteData | null {
    if (frequency <= 0) return null;

    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;

    const note = noteStrings[midi % 12];
    const octave = Math.floor(midi / 12) - 1;

    const idealFreq = 440 * Math.pow(2, (midi - 69) / 12);
    const deviation = frequency - idealFreq;
    const cents = 1200 * Math.log2(frequency / idealFreq);

    return {
        note: `${note}${octave}`,
        frequency: frequency,
        cents: cents,
        deviation: deviation
    };
}
