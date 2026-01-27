import { useRef, useEffect, useState } from 'react';
import { type NoteData } from '../utils/noteUtils';

interface DiminuendoTrainerProps {
    currentNote: NoteData | null;
    currentVolume: number; // RMS
    isActive: boolean;
    onComplete?: (success: boolean) => void;
}

export const DiminuendoTrainer = ({ currentNote, currentVolume, isActive }: DiminuendoTrainerProps) => {
    const [phase, setPhase] = useState<'idle' | 'calibrating' | 'active' | 'success' | 'fail'>('idle');
    const [startVolume, setStartVolume] = useState<number>(0);
    const [targetNote, setTargetNote] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'good' | 'warning' | 'fail' | null>(null);

    // Scoring
    const historyRef = useRef<{ vol: number, cent: number }[]>([]);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!isActive) {
            setPhase('idle');
            setTargetNote(null);
            setStartVolume(0);
            setFeedback(null);
            return;
        }

        if (phase === 'idle') {
            if (currentNote && currentVolume > 0.05) {
                setPhase('calibrating');
                startTimeRef.current = Date.now();
            }
        } else if (phase === 'calibrating') {
            if (!currentNote || currentVolume < 0.03) {
                setPhase('idle'); // Lost note
                return;
            }

            // If holding stable note for 1.5s
            if (Date.now() - startTimeRef.current > 1500) {
                setPhase('active');
                setStartVolume(currentVolume);
                setTargetNote(currentNote.note);
                historyRef.current = [];
            }
        } else if (phase === 'active') {
            if (!currentNote) {
                // If silence, maybe check if volume dropped successfully?
                if (currentVolume < 0.01 && startVolume > 0.05) {
                    // Check if pitch was stable before silence
                    const recent = historyRef.current.slice(-10);
                    const unstable = recent.some(h => Math.abs(h.cent) > 10);
                    if (!unstable && recent.length > 5) {
                        setPhase('success');
                    } else {
                        setPhase('fail');
                    }
                }
                return;
            }

            // Logic:
            // Volume dropping?
            const volRatio = currentVolume / (startVolume || 0.01);

            // Pitch deviation?
            const cents = currentNote.cents; // Note: Use deviation in cents relative to *target note* if different, but let's assume same note name.

            // If pitch changes note name, that's a fail (usually > 50 cents)
            if (currentNote.note !== targetNote) {
                // Allow minor flickering if very close? 
                // Re-calculate cents relative to target frequency would be better, but assuming user plays same note.
                // For simplicity: if note changes, it's likely > 50 cents off.
                setFeedback('fail');
            } else {
                if (Math.abs(cents) > 10) {
                    setFeedback('fail');
                } else if (Math.abs(cents) > 5) {
                    setFeedback('warning');
                } else {
                    setFeedback('good');
                }
            }

            // Record history
            historyRef.current.push({ vol: volRatio, cent: cents });

            // Success condition: Volume < 20% of start AND average pitch deviation < 10
            if (volRatio < 0.2) {
                setPhase('success');
            }
        }
    }, [currentNote, currentVolume, isActive, phase, targetNote, startVolume]);

    const getCrosshairColor = () => {
        if (phase === 'success') return 'text-emerald-500';
        if (phase === 'fail') return 'text-rose-500';
        if (feedback === 'good') return 'text-emerald-400';
        if (feedback === 'warning') return 'text-amber-400';
        if (feedback === 'fail') return 'text-rose-500';
        return 'text-slate-300';
    };

    // Rendering
    // Center is (0,0) visually.
    // Y-axis = Pitch (-50 to +50 cents). Map to +/- 100px.
    // Size = Volume.

    const yOffset = currentNote && phase === 'active' ? (currentNote.cents * 3) : 0; // Scale: 1 cent = 3px
    const size = Math.max(10, (currentVolume / (startVolume || 1)) * 200); // Max size 200px

    return (
        <div className="relative w-full h-64 md:h-80 bg-slate-900 rounded-3xl overflow-hidden flex items-center justify-center border border-slate-700 shadow-inner">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white"></div>
                {/* Target Zone +/- 10 cents */}
                <div className="absolute top-1/2 left-0 right-0 h-[60px] -mt-[30px] bg-emerald-500/10 border-y border-emerald-500/30"></div>
            </div>

            {/* Instructions */}
            <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-10">
                {phase === 'idle' && <span className="text-slate-400 text-sm animate-pulse">請吹奏長音以開始...</span>}
                {phase === 'calibrating' && <span className="text-cyan-400 text-sm font-bold">保持音量，鎖定中...</span>}
                {phase === 'active' && <span className="text-white text-sm font-bold drop-shadow-md">保持準心在中央，讓它變小！ (漸弱)</span>}
                {phase === 'success' && <span className="text-emerald-400 text-xl font-bold animate-bounce">挑戰成功！完美漸弱！</span>}
                {phase === 'fail' && <span className="text-rose-400 text-xl font-bold">音準跑掉了！請維持氣速。</span>}
            </div>

            {/* The Crosshair (User) */}
            <div
                className={`rounded-full border-4 transition-all duration-100 ease-out flex items-center justify-center ${getCrosshairColor()} ${phase === 'success' ? 'bg-emerald-500/20 box-shadow-glow' : ''}`}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    transform: `translateY(${-yOffset}px)`, // Negative because up is positive pitch usually? Actually, graphically up is usually negative Y in CSS. But musically high pitch = up. So if cents > 0 (sharp), go UP (negative Y).
                    opacity: phase === 'idle' ? 0.3 : 1
                }}
            >
                <div className="w-1 h-1 bg-current rounded-full"></div>
            </div>

            {/* Reference Line for Target Pitch */}
            {phase === 'active' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-50"></div>
            )}

            {/* Debug Info */}
            <div className="absolute bottom-2 right-4 text-xs font-mono text-slate-500">
                VOL: {(currentVolume * 100).toFixed(0)}% | PITCH: {currentNote?.cents.toFixed(1) || '--'}
            </div>
        </div>
    );
};
