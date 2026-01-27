import { useState, useEffect, useRef } from 'react'
import { AudioEngine } from './audio/AudioEngine'
import { AudioAnalyzer } from './audio/Analyzer'
import Visualizer, { type VisualizerHandle, type VisualizerTheme } from './visualizer/Visualizer'
import { DiminuendoTrainer } from './components/DiminuendoTrainer'
import { CameraView } from './components/CameraView'
import { getNoteFromFrequency, type NoteData } from './utils/noteUtils'
import { type EmbouchureMetrics } from './ai/embouchureLogic'
import { saveAnalysisLog } from './ai/AnalysisService'

interface HistoryItem {
  id: string;
  timestamp: number;
  note: NoteData;
  harmonicsScore: number;
  pitchStability: number | null;
}

type AppMode = 'analysis' | 'trainer';

function App() {
  const [isStarted, setIsStarted] = useState(false);

  // Device Controls
  const [showCamera, setShowCamera] = useState(true);
  const [micEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Theme & UI
  const [theme, setTheme] = useState<VisualizerTheme>('aurora');
  const [mode, setMode] = useState<AppMode>('analysis');
  const [showUsage, setShowUsage] = useState(true);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurora_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const engineRef = useRef<AudioEngine | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const visualizerRef = useRef<VisualizerHandle>(null);
  const [currentNote, setCurrentNote] = useState<NoteData | null>(null);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [embouchureMetrics, setEmbouchureMetrics] = useState<EmbouchureMetrics | null>(null);
  const [harmonics, setHarmonics] = useState<{ f1: number, f2: number, f3: number, score: number } | null>(null);
  const [pitchStability, setPitchStability] = useState<number | null>(null);
  const pitchHistory = useRef<number[]>([]);

  useEffect(() => {
    analyzerRef.current = new AudioAnalyzer(4096);
    engineRef.current = new AudioEngine();

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // Handle Mic Toggle
  useEffect(() => {
    if (!isStarted) return;

    if (micEnabled) {
      engineRef.current?.resume();
    } else {
      engineRef.current?.suspend();
    }
  }, [micEnabled, isStarted]);

  const handleStart = async () => {
    if (!engineRef.current) return;

    try {
      if (!isStarted) {
        // Start Audio Context
        await engineRef.current.init((data, pitch, rms) => {
          if (!micEnabled) return;

          if (rms !== undefined) setCurrentVolume(rms);

          if (analyzerRef.current && visualizerRef.current) {
            const magnitudes = analyzerRef.current.analyze(data);
            const scaled = magnitudes.map(m => m * sensitivity);
            visualizerRef.current.draw(scaled);
          }

          if (pitch && pitch > 0) {
            const noteData = getNoteFromFrequency(pitch);
            setCurrentNote(noteData);

            if (engineRef.current?.context) {
              const sampleRate = engineRef.current.context.sampleRate;
              const h = analyzerRef.current?.getHarmonics(pitch, sampleRate);
              if (h) setHarmonics(h);
            }

            pitchHistory.current.push(pitch);
            if (pitchHistory.current.length > 10) pitchHistory.current.shift();

            if (pitchHistory.current.length >= 5) {
              const mean = pitchHistory.current.reduce((a, b) => a + b, 0) / pitchHistory.current.length;
              const variance = pitchHistory.current.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pitchHistory.current.length;
              setPitchStability(Math.sqrt(variance));
            }
          } else {
            pitchHistory.current = [];
            setPitchStability(null);
            setHarmonics(null);
          }
        });
        setIsStarted(true);
      }
    } catch (e) {
      console.error("Failed to start audio", e);
      alert("啟動失敗，請檢查權限設定。");
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      if (!currentNote) {
        alert("尚無數據可儲存");
        return;
      }
      const docId = await saveAnalysisLog(currentNote, embouchureMetrics, harmonics, pitchStability);

      // Save to local history
      const newItem: HistoryItem = {
        id: docId,
        timestamp: Date.now(),
        note: currentNote,
        harmonicsScore: harmonics ? harmonics.score : 0,
        pitchStability: pitchStability
      };

      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('aurora_history', JSON.stringify(updatedHistory));

      alert("✅ 紀錄已儲存！");
    } catch (error) {
      console.error(error);
      alert("儲存失敗");
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    if (confirm('確定要刪除此紀錄嗎？')) {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      localStorage.setItem('aurora_history', JSON.stringify(updated));
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      // Stop
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start - Need to combine streams if we want video + audio
      // For simplicity v2: Just record audio context destination or stream if possible.
      // A better approach for "App Recording" is capturing the canvas stream + audio stream.
      // For now, let's try to capture the screen or just the audio if simple.
      // Let's go with effective "Session Recording" -> Audio + Camera Stream if available?
      // Actually, easiest is capturing the provided streams.

      try {

        // Note: engineRef stream is input. To record "what is played", we need the input stream.
        // Let's use the input stream from getUserMedia if we have it stored? 
        // Accessing internal stream might be hard. 
        // Alternative: use displayMedia for full screen record (best for visualizer app)

        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          recordedChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aurora-session-${new Date().toISOString()}.webm`;
            a.click();
          };

          mediaRecorder.start();
          setIsRecording(true);
        }).catch(e => {
          console.error("Screen capture failed", e);
          alert("錄製需要螢幕錄製權限");
        });

      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Helper for gradient text based on theme
  const getThemeGradient = () => {
    switch (theme) {
      case 'sunset': return 'from-pink-500 to-orange-400';
      case 'ocean': return 'from-blue-500 to-teal-400';
      default: return 'from-emerald-600 to-cyan-600';
    }
  };

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden text-slate-700 selection:bg-cyan-200 transition-colors duration-700 ${theme === 'sunset' ? 'bg-[#fff7ed]' : theme === 'ocean' ? 'bg-[#f0f9ff]' : 'bg-[#fdfaff]'
      }`}>

      {/* --- Ambient Background Blobs (Dynamic Theme) --- */}
      {theme === 'aurora' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>
        </>
      )}
      {theme === 'sunset' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-rose-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>
        </>
      )}
      {theme === 'ocean' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>
        </>
      )}

      {/* --- Noise Texture --- */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <main className="relative z-10 container mx-auto px-4 md:px-6 py-4 md:py-8 max-w-7xl flex flex-col gap-6 md:gap-8 h-full">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2rem] p-4 shadow-sm gap-4">
          <div className="flex items-center gap-4 pl-2 md:pl-4 w-full md:w-auto">
            {/* Logo Icon - Aurora Gradient */}
            <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr shadow-lg ${getThemeGradient()} text-white shrink-0`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 6.97a.75.75 0 011.06 0l2.37 2.37a.75.75 0 01-1.06 1.06l-2.37-2.37a.75.75 0 11-1.06-1.06l2.37-2.37a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className={`text-2xl font-bold bg-gradient-to-r ${getThemeGradient()} bg-clip-text text-transparent`}>Aurora</h1>
              <p className="text-xs text-slate-500 tracking-widest font-medium hidden sm:block">看見你的聲音，點亮你的極光</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto">
            {/* Mode Switcher */}
            <div className="flex bg-white/40 rounded-full p-1 backdrop-blur-md border border-white/30 mr-2">
              <button
                onClick={() => setMode('analysis')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'analysis' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                分析模式
              </button>
              <button
                onClick={() => setMode('trainer')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'trainer' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                漸弱訓練
              </button>
            </div>

            {/* Sensitivity Slider */}
            <div className="flex items-center gap-2 bg-white/40 rounded-full px-4 py-2 backdrop-blur-md border border-white/30 mr-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:block">靈敏度</span>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-20 md:w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
              />
            </div>

            {/* Theme Select */}
            <div className="flex bg-white/40 rounded-full p-1 backdrop-blur-md border border-white/30">
              {(['aurora', 'ocean', 'sunset'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${t === 'aurora' ? 'bg-gradient-to-br from-emerald-400 to-purple-400' :
                    t === 'ocean' ? 'bg-gradient-to-br from-blue-400 to-teal-400' :
                      'bg-gradient-to-br from-orange-400 to-rose-400'
                    } ${theme === t ? 'ring-2 ring-slate-400 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
                  title={t}
                />
              ))}
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-slate-600 transition-colors"
              title="全螢幕"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>

            {isStarted && (
              <>
                <button
                  onClick={toggleRecording}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all backdrop-blur-md border flex items-center gap-2 ${isRecording
                    ? 'bg-rose-500 text-white border-rose-500 animate-pulse'
                    : 'bg-white/20 border-white/20 text-slate-500 hover:bg-white/30'
                    }`}
                >
                  {isRecording ? (
                    <><div className="w-2 h-2 bg-white rounded-full"></div> 錄製中</>
                  ) : (
                    <><div className="w-2 h-2 bg-rose-500 rounded-full"></div> 錄製</>
                  )}
                </button>
              </>
            )}

            {!isStarted ? (
              <button
                onClick={handleStart}
                className={`bg-gradient-to-r ${getThemeGradient()} text-white px-6 md:px-8 py-3 rounded-full text-sm font-bold shadow-lg transform hover:scale-105 transition-all`}
              >
                開始分析
              </button>
            ) : (
              <button
                onClick={handleSaveSnapshot}
                className="bg-white/50 hover:bg-white/80 border border-white/50 text-slate-600 px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm"
              >
                儲存極光
              </button>
            )}
          </div>
        </header>

        {/* Usage Guide Banner */}
        {showUsage && !isStarted && (
          <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="absolute top-0 right-0 p-4">
              <button onClick={() => setShowUsage(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2 tracking-tight">
                歡迎使用 Aurora
              </h2>
              <p className="text-slate-500 font-medium text-sm tracking-wide">
                簡單三步驟，開啟您的極光之旅
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {[
                { step: "01", text: "允許麥克風權限", icon: (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>) },
                { step: "02", text: "點擊開始分析", icon: (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>) },
                { step: "03", text: "吹奏並看見極光", icon: (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>) }
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 bg-white/40 rounded-2xl px-5 py-4 border border-white/30 shadow-sm flex-1 sm:flex-initial group hover:bg-white/60 transition-colors">
                  <div className="bg-white/50 p-2 rounded-full shadow-sm">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.step}</span>
                    <span className="text-sm font-bold text-slate-600">{item.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start pb-8">

          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">

            {/* Main Visualizer or Trainer */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>

              <div className="relative bg-white/40 rounded-[2rem] p-4 md:p-6 h-[18rem] md:h-[22rem]">
                {mode === 'analysis' ? (
                  <>
                    <div className="absolute top-4 md:top-6 left-6 md:left-8 z-10">
                      <h2 className="text-xl font-bold text-slate-700">
                        {theme === 'sunset' ? '日落頻譜' : theme === 'ocean' ? '海洋頻譜' : '極光頻譜'}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {theme === 'sunset' ? 'Geometric Sunset' : theme === 'ocean' ? 'Deep Ocean' : 'Harmonic Aurora'}
                      </p>
                    </div>

                    {micEnabled ? (
                      <div className="h-full w-full opacity-90 mix-blend-multiply">
                        <Visualizer ref={visualizerRef} theme={theme} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/30 backdrop-blur text-slate-500 px-6 py-3 rounded-full text-sm font-medium">
                          麥克風已靜音
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <DiminuendoTrainer
                      currentNote={currentNote}
                      currentVolume={currentVolume}
                      isActive={isStarted}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 gap-6 md:gap-8">

              {/* Compact Note & Quality Row for Mobile */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Note Bubble */}
                <div className="bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 md:p-8 relative flex flex-col justify-center items-center shadow-sm flex-1">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detected Note</h3>
                  <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr ${theme === 'sunset' ? 'from-orange-100 to-rose-100' : theme === 'ocean' ? 'from-blue-100 to-teal-100' : 'from-emerald-100 to-cyan-100'} flex items-center justify-center shadow-inner relative mb-2 transition-colors duration-500`}>
                    <span className="text-6xl md:text-7xl font-black text-slate-700 tracking-tighter">
                      {currentNote ? currentNote.note : '--'}
                    </span>
                    {currentNote && (
                      <span className={`absolute -right-2 top-0 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-sm font-bold shadow-sm ${Math.abs(currentNote.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {currentNote.cents > 0 ? '+' : ''}{currentNote.cents.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-slate-500 mt-2 bg-white/30 px-4 py-1 rounded-full text-sm">
                    {currentNote ? `${currentNote.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                  </p>
                </div>

                {/* Quality Bars */}
                <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 md:p-8 flex flex-col justify-center shadow-sm flex-1">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Sound Quality</h3>

                  <div className="space-y-6">
                    <div className="bg-white/40 rounded-2xl p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 font-medium">共鳴度</span>
                        <span className={`font-bold ${theme === 'sunset' ? 'text-orange-600' : 'text-cyan-600'}`}>{harmonics ? (harmonics.score * 100).toFixed(0) : 0}%</span>
                      </div>
                      <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
                        <div style={{ width: `${harmonics ? (harmonics.score * 100) : 0}%` }} className={`h-full bg-gradient-to-r ${theme === 'sunset' ? 'from-orange-400 to-rose-400' : theme === 'ocean' ? 'from-blue-400 to-teal-400' : 'from-emerald-400 to-cyan-400'} rounded-full transition-all duration-300`}></div>
                      </div>
                    </div>

                    <div className="bg-white/40 rounded-2xl p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 font-medium">穩定性</span>
                        <span className="font-bold text-indigo-600">{pitchStability ? pitchStability.toFixed(1) : '--'}</span>
                      </div>
                      <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
                        <div style={{ width: `${Math.max(0, 100 - (pitchStability || 0) * 10)}%` }} className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-300"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column (4 cols) - Camera & Details */}
          <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8">

            {/* Camera View */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm">
              <div className="flex justify-between items-center px-4 py-2">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Embouchure Cam</span>
                <button
                  onClick={() => setShowCamera(!showCamera)}
                  className={`text-xs px-2 py-1 rounded-full border ${showCamera ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                >
                  {showCamera ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="bg-black/5 rounded-[2rem] overflow-hidden aspect-[4/3] relative">
                {showCamera ? (
                  <CameraView onMetricsUpdate={setEmbouchureMetrics} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <span className="text-sm font-medium">相機已暫停</span>
                  </div>
                )}

                {/* Floating Metrics Overlay */}
                <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center">
                    <span className="text-[10px] uppercase text-white/80 font-bold block">開口大小</span>
                    <span className="text-lg font-mono text-white font-medium drop-shadow-md">
                      {embouchureMetrics ? embouchureMetrics.aperture.toFixed(1) : '--'}
                    </span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center">
                    <span className="text-[10px] uppercase text-white/80 font-bold block">嘴巴寬度</span>
                    <span className="text-lg font-mono text-white font-medium drop-shadow-md">
                      {embouchureMetrics ? embouchureMetrics.width.toFixed(1) : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Harmonics / Tips */}
            <div className="bg-gradient-to-b from-white/40 to-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-8 flex-1 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">泛音結構</h3>

              <div className="flex justify-center items-end gap-6 h-40 mb-6">
                {/* Dynamic Theme Colors for Bars */}
                {[
                  { label: 'F1', val: harmonics?.f1 },
                  { label: 'F2', val: harmonics?.f2 },
                  { label: 'F3', val: harmonics?.f3 }
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="w-10 bg-white/40 rounded-full relative h-40 flex items-end overflow-hidden p-1 shadow-inner">
                      <div
                        className={`w-full rounded-full transition-all duration-300 ${theme === 'sunset' ? 'bg-gradient-to-t from-orange-400 to-rose-300' :
                          theme === 'ocean' ? 'bg-gradient-to-t from-blue-500 to-teal-300' :
                            'bg-gradient-to-t from-emerald-400 to-cyan-300'
                          }`}
                        style={{ height: `${Math.min(((bar.val || 0) / 255) * 100 * (1 + i * 0.4), 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{bar.label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white/40 rounded-2xl p-4 text-center border border-white/30">
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  "音色越飽滿，{theme === 'sunset' ? '夕陽越紅豔' : theme === 'ocean' ? '海洋越深邃' : '極光越明亮'}。<br />試著放鬆喉嚨，讓聲音流動。"
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* History Gallery Section */}
        {history.length > 0 && (
          <div className="w-full pb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                歷史藝廊
              </h2>
              <button
                onClick={() => {
                  if (confirm('確定要清除所有歷史紀錄嗎？')) {
                    setHistory([]);
                    localStorage.removeItem('aurora_history');
                  }
                }}
                className="text-xs text-rose-500 hover:text-rose-600 font-bold px-3 py-1 bg-rose-50 rounded-full border border-rose-100 transition-colors"
              >
                清除全部
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {history.map((item) => (
                <div key={item.id} className="group relative bg-white/40 hover:bg-white/60 backdrop-blur-md border border-white/40 rounded-3xl p-5 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      className="text-slate-300 hover:text-rose-400 transition-colors p-1"
                      title="刪除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${theme === 'sunset' ? 'from-orange-100 to-rose-100 text-rose-600' :
                      theme === 'ocean' ? 'from-blue-100 to-teal-100 text-teal-600' :
                        'from-emerald-100 to-cyan-100 text-emerald-600'
                      } shadow-inner`}>
                      <span className="text-2xl font-black">{item.note.note}</span>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">音準偏差</span>
                        <span className={`font-bold ${Math.abs(item.note.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {item.note.cents > 0 ? '+' : ''}{item.note.cents.toFixed(0)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${Math.abs(item.note.deviation) < 5 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.max(0, 100 - Math.abs(item.note.deviation) * 2)}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/50">
                        <span className="text-slate-500 font-medium">共鳴度</span>
                        <span className="font-bold text-indigo-500">{(item.harmonicsScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </main>
    </div>
  )
}

export default App
