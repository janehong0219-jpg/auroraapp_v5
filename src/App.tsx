import { useState, useEffect, useRef } from 'react'
import { AudioEngine } from './audio/AudioEngine'
import { AudioAnalyzer } from './audio/Analyzer'
import Visualizer, { type VisualizerHandle } from './visualizer/Visualizer'
import { CameraView } from './components/CameraView'
import { getNoteFromFrequency, type NoteData } from './utils/noteUtils'
import { type EmbouchureMetrics } from './ai/embouchureLogic'
import { saveAnalysisLog } from './ai/AnalysisService'

function App() {
  const [isStarted, setIsStarted] = useState(false);

  // Device Controls
  const [showCamera, setShowCamera] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const engineRef = useRef<AudioEngine | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const visualizerRef = useRef<VisualizerHandle>(null);
  const [currentNote, setCurrentNote] = useState<NoteData | null>(null);
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
        await engineRef.current.init((data, pitch) => {
          if (!micEnabled) return;

          if (analyzerRef.current && visualizerRef.current) {
            const magnitudes = analyzerRef.current.analyze(data);
            visualizerRef.current.draw(magnitudes);
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
      if (!currentNote && !embouchureMetrics && !harmonics) {
        alert("尚無數據可儲存，請先進行吹奏。");
        return;
      }

      await saveAnalysisLog(currentNote, embouchureMetrics, harmonics, pitchStability);
      alert("✅ 紀錄已儲存！");
    } catch (error) {
      console.error(error);
      alert("儲存失敗");
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-slate-700 selection:bg-cyan-200">

      {/* --- Ambient Background Blobs (Aurora Colors) --- */}
      {/* Emerald (Green) */}
      <div className="fixed top-0 -left-10 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob"></div>
      {/* Cyan (Blue-Green) */}
      <div className="fixed top-0 -right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
      {/* Violet (Purple) - Deeper contrast */}
      <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>

      {/* --- Noise Texture --- */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <main className="relative z-10 container mx-auto px-6 py-8 max-w-7xl flex flex-col gap-8 h-full">

        {/* Header Section */}
        <header className="flex justify-between items-center bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2rem] p-4 shadow-sm">
          <div className="flex items-center gap-4 pl-4">
            {/* Logo Icon - Aurora Gradient */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 via-cyan-400 to-indigo-400 shadow-lg shadow-cyan-200">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 6.97a.75.75 0 011.06 0l2.37 2.37a.75.75 0 01-1.06 1.06l-2.37-2.37a.75.75 0 010-1.06zm0 10.06a.75.75 0 010 1.06l-2.37 2.37a.75.75 0 11-1.06-1.06l2.37-2.37a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Aurora</h1>
              <p className="text-xs text-slate-500 tracking-widest font-medium">看見你的聲音，點亮你的極光</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isStarted && (
              <>
                {/* Camera Toggle */}
                <button
                  onClick={() => setShowCamera(!showCamera)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all backdrop-blur-md border ${showCamera
                      ? 'bg-white/60 border-white/60 text-slate-700 shadow-sm'
                      : 'bg-white/20 border-white/20 text-slate-500 hover:bg-white/30'
                    }`}
                >
                  {showCamera ? '相機 ON' : '相機 OFF'}
                </button>

                {/* Mic Toggle */}
                <button
                  onClick={() => setMicEnabled(!micEnabled)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all backdrop-blur-md border ${micEnabled
                      ? 'bg-white/60 border-white/60 text-slate-700 shadow-sm'
                      : 'bg-white/20 border-white/20 text-slate-500 hover:bg-white/30'
                    }`}
                >
                  {micEnabled ? '麥克風 ON' : '麥克風 OFF'}
                </button>
              </>
            )}

            {!isStarted ? (
              <button
                onClick={handleStart}
                className="bg-gradient-to-r from-emerald-400 to-cyan-500 hover:from-emerald-500 hover:to-cyan-600 text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-cyan-200 transform hover:scale-105 transition-all"
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-8">

            {/* Main Visualizer */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>

              <div className="relative bg-white/40 rounded-[2rem] p-6 h-[20rem]">
                <div className="absolute top-6 left-8 z-10">
                  <h2 className="text-xl font-bold text-slate-700">極光頻譜</h2>
                  <p className="text-sm text-slate-500">Harmonic Aurora</p>
                </div>

                {micEnabled ? (
                  <div className="h-full w-full opacity-90 mix-blend-multiply">
                    <Visualizer ref={visualizerRef} />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/30 backdrop-blur text-slate-500 px-6 py-3 rounded-full text-sm font-medium">
                      麥克風已靜音
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Note Bubble */}
              <div className="bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-8 relative flex flex-col justify-center items-center shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detected Note</h3>
                {/* Gradient Circle matching Aurora Theme */}
                <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-emerald-100 to-cyan-100 flex items-center justify-center shadow-inner relative mb-2">
                  <span className="text-7xl font-black text-slate-700 tracking-tighter">
                    {currentNote ? currentNote.note : '--'}
                  </span>
                  {currentNote && (
                    <span className={`absolute -right-2 top-0 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-sm font-bold shadow-sm ${Math.abs(currentNote.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {currentNote.cents > 0 ? '+' : ''}{currentNote.cents.toFixed(0)}
                    </span>
                  )}
                </div>
                <p className="font-mono text-slate-500 mt-2 bg-white/30 px-4 py-1 rounded-full">
                  {currentNote ? `${currentNote.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                </p>
              </div>

              {/* Quality Bars */}
              <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-8 flex flex-col justify-center shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Sound Quality</h3>

                <div className="space-y-6">
                  <div className="bg-white/40 rounded-2xl p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600 font-medium">極光亮度 (共鳴)</span>
                      <span className="font-bold text-cyan-600">{harmonics ? (harmonics.score * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
                      <div style={{ width: `${harmonics ? (harmonics.score * 100) : 0}%` }} className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-300"></div>
                    </div>
                  </div>

                  <div className="bg-white/40 rounded-2xl p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600 font-medium">波動穩定性</span>
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

          {/* Right Column (4 cols) - Camera & Details */}
          <div className="lg:col-span-4 flex flex-col gap-8">

            {/* Camera View */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm">
              <div className="bg-black/5 rounded-[2rem] overflow-hidden aspect-[4/3] relative">
                {showCamera ? (
                  <CameraView onMetricsUpdate={setEmbouchureMetrics} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-200/50 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">相機已關閉</span>
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
                {/* Northern Lights Gradient Colors for Bars */}
                {[
                  { label: 'F1', val: harmonics?.f1, color: 'from-emerald-400 to-teal-300' },
                  { label: 'F2', val: harmonics?.f2, color: 'from-cyan-400 to-sky-300' },
                  { label: 'F3', val: harmonics?.f3, color: 'from-indigo-400 to-purple-300' }
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="w-10 bg-white/40 rounded-full relative h-40 flex items-end overflow-hidden p-1 shadow-inner">
                      <div
                        className={`w-full rounded-full bg-gradient-to-t ${bar.color} transition-all duration-300`}
                        style={{ height: `${Math.min(((bar.val || 0) / 255) * 100 * (1 + i * 0.4), 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{bar.label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white/40 rounded-2xl p-4 text-center border border-white/30">
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  "音色越飽滿，極光越明亮。<br />試著放鬆喉嚨，讓極光升起。"
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

export default App
