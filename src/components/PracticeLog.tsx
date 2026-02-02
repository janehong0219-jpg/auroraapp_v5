import { useState, useEffect } from 'react';
import { checkIn, addSong, removeSong, updateNotes, getTodayLog, getPracticeLogs, getPracticeStreak, type PracticeLogData, type PracticeSong } from '../ai/PracticeService';

interface PracticeLogProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'aurora' | 'sunset' | 'ocean';
    currentToneQuality?: {
        overall: number;
        brightness: number;
        richness: number;
        balance: number;
    } | null;
}

const encouragingMessages = [
    "每一次練習都是進步！🎵",
    "音樂就是要享受～",
    "你做得很棒！繼續保持！✨",
    "慢慢來，比較快 🌸",
    "今天的你又進步了一點點！",
    "享受音樂的每一刻 🎶",
];

export default function PracticeLog({ isOpen, onClose, theme, currentToneQuality }: PracticeLogProps) {
    const [todayLog, setTodayLog] = useState<PracticeLogData | null>(null);
    const [newSongName, setNewSongName] = useState('');
    const [notes, setNotes] = useState('');
    const [streak, setStreak] = useState(0);
    const [recentLogs, setRecentLogs] = useState<Map<string, PracticeLogData>>(new Map());
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

    const themeColors = {
        aurora: 'from-emerald-400 to-cyan-400',
        sunset: 'from-orange-400 to-rose-400',
        ocean: 'from-blue-400 to-teal-400',
    };

    const themeBg = {
        aurora: 'bg-emerald-50',
        sunset: 'bg-orange-50',
        ocean: 'bg-blue-50',
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const log = await getTodayLog();
        setTodayLog(log);
        setIsCheckedIn(log?.checkedIn || false);
        setNotes(log?.notes || '');

        const streakCount = await getPracticeStreak();
        setStreak(streakCount);

        const logs = await getPracticeLogs(30);
        setRecentLogs(logs);
    };

    const handleCheckIn = async () => {
        await checkIn(new Date(), currentToneQuality || undefined);
        setIsCheckedIn(true);
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 2000);
        loadData();
    };

    const handleAddSong = async () => {
        if (!newSongName.trim()) return;

        const songData: PracticeSong = {
            name: newSongName.trim(),
        };

        await addSong(songData);
        setNewSongName('');
        loadData();
    };

    const handleRemoveSong = async (index: number) => {
        await removeSong(index);
        loadData();
    };

    const handleNotesBlur = async () => {
        if (notes !== (todayLog?.notes || '')) {
            await updateNotes(notes);
            loadData();
        }
    };

    const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];

    // Generate calendar for the last 30 days
    const generateCalendar = () => {
        const days = [];
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const log = recentLogs.get(dateKey);

            days.push({
                date: date.getDate(),
                isToday: i === 0,
                checkedIn: log?.checkedIn || false,
            });
        }

        return days;
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Side Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-white/95 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="h-full overflow-y-auto p-6 md:p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className={`text-2xl font-bold bg-gradient-to-r ${themeColors[theme]} bg-clip-text text-transparent`}>
                                練習日誌
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">記錄你的音樂旅程 🎵</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-slate-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Check-in Section */}
                    <div className={`${themeBg[theme]} rounded-3xl p-6 mb-6 relative overflow-hidden`}>
                        {showSuccessAnimation && (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 animate-pulse" />
                        )}

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-700">今日練習</h3>
                                <div className="flex gap-2">
                                    {todayLog?.toneQuality && (
                                        <div className="flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full">
                                            <span className="text-xs text-slate-500">音色</span>
                                            <span className={`text-sm font-bold ${todayLog.toneQuality.overall >= 80 ? 'text-emerald-500' :
                                                    todayLog.toneQuality.overall >= 60 ? 'text-cyan-500' :
                                                        'text-amber-500'
                                                }`}>
                                                {Math.round(todayLog.toneQuality.overall)}%
                                            </span>
                                        </div>
                                    )}
                                    {streak > 0 && (
                                        <div className="flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full">
                                            <span className="text-xl">🔥</span>
                                            <span className="text-sm font-bold text-slate-700">{streak} 天</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isCheckedIn ? (
                                <button
                                    onClick={handleCheckIn}
                                    className={`w-full bg-gradient-to-r ${themeColors[theme]} text-white px-6 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all`}
                                >
                                    今天已練習 ✓
                                </button>
                            ) : (
                                <div className="text-center py-3">
                                    <div className="text-5xl mb-2">🎉</div>
                                    <p className="text-lg font-bold text-slate-700">{randomMessage}</p>
                                    {currentToneQuality && (
                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            <div className="bg-white/60 rounded-xl p-2">
                                                <div className="text-[10px] text-slate-500 font-bold">明亮度</div>
                                                <div className="text-base font-black text-slate-600">{currentToneQuality.brightness}%</div>
                                            </div>
                                            <div className="bg-white/60 rounded-xl p-2">
                                                <div className="text-[10px] text-slate-500 font-bold">豐富度</div>
                                                <div className="text-base font-black text-slate-600">{currentToneQuality.richness}%</div>
                                            </div>
                                            <div className="bg-white/60 rounded-xl p-2">
                                                <div className="text-[10px] text-slate-500 font-bold">平衡度</div>
                                                <div className="text-base font-black text-slate-600">{currentToneQuality.balance}%</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Songs Section */}
                    <div className="bg-slate-50 rounded-3xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">練習曲目</h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newSongName}
                                onChange={(e) => setNewSongName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddSong()}
                                placeholder="曲子名稱..."
                                className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-slate-200 focus:border-slate-300 outline-none transition-colors text-slate-700"
                            />
                            <button
                                onClick={handleAddSong}
                                className={`bg-gradient-to-r ${themeColors[theme]} text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all`}
                            >
                                +
                            </button>
                        </div>

                        <div className="space-y-2">
                            {todayLog?.songs.map((song, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 group hover:border-slate-300 transition-colors"
                                >
                                    <span className="text-slate-700 font-medium">{song.name}</span>
                                    <button
                                        onClick={() => handleRemoveSong(index)}
                                        className="text-slate-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {(!todayLog?.songs || todayLog.songs.length === 0) && (
                            <p className="text-center text-slate-400 text-sm py-8">還沒有練習曲目喔～</p>
                        )}
                    </div>

                    {/* Notes Section */}
                    <div className="bg-slate-50 rounded-3xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">練習筆記</h3>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={handleNotesBlur}
                            placeholder="今天的感想、目標或想記錄的事..."
                            className="w-full h-32 px-4 py-3 rounded-xl bg-white border-2 border-slate-200 focus:border-slate-300 outline-none transition-colors resize-none text-slate-700"
                        />
                    </div>

                    {/* Calendar */}
                    <div className="bg-slate-50 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">練習紀錄</h3>
                        <div className="grid grid-cols-7 gap-2">
                            {generateCalendar().map((day, index) => (
                                <div
                                    key={index}
                                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${day.checkedIn
                                        ? `bg-gradient-to-br ${themeColors[theme]} text-white shadow-md`
                                        : 'bg-white text-slate-300 border border-slate-200'
                                        } ${day.isToday ? 'ring-2 ring-slate-400 ring-offset-2' : ''}`}
                                >
                                    {day.date}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-4 text-center">
                            點點滴滴的累積，就是最美的風景 🌈
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
