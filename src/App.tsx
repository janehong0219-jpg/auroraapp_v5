import { useState, useEffect, useRef } from 'react'
import { AudioEngine } from './audio/AudioEngine'
import { AudioAnalyzer } from './audio/Analyzer'
import Visualizer, { type VisualizerHandle, type VisualizerTheme } from './visualizer/Visualizer'
import { DiminuendoTrainer } from './components/DiminuendoTrainer'
import { CameraView } from './components/CameraView'
import PracticeLog from './components/PracticeLog'
import TrebleClefIcon from './components/TrebleClefIcon'
import { SimpleAnalyticsDashboard } from './components/SimpleAnalyticsDashboard'
import { getNoteFromFrequency, type NoteData } from './utils/noteUtils'
import { saveAnalysisLog } from './ai/AnalysisService'
import { ToneAnalyzer, type ToneQuality, type ToneSuggestion } from './utils/ToneAnalyzer'
import { PracticeDataBuffer, type PitchPoint, type VolumePoint } from './utils/PracticeDataBuffer'
import { INSTRUMENT_CONFIGS, type InstrumentType } from './utils/InstrumentConfig'
import { type UnifiedEmbouchureMetrics } from './ai/embouchureLogic'
import { type ShoulderMetrics } from './ai/PostureDetector'

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
  const [showPracticeLog, setShowPracticeLog] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>('vocal');
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);

  // 噪音抑制設定
  const [noiseSuppression, setNoiseSuppression] = useState({
    enabled: true,
    highPassCutoff: 150,      // Hz
    noiseGateThreshold: 0.01  // 1%
  });

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
  const [embouchureMetrics, setEmbouchureMetrics] = useState<UnifiedEmbouchureMetrics | null>(null);
  const [harmonics, setHarmonics] = useState<{ f1: number, f2: number, f3: number, score: number } | null>(null);
  const [toneQuality, setToneQuality] = useState<ToneQuality | null>(null);
  const [toneSuggestion, setToneSuggestion] = useState<ToneSuggestion | null>(null);

  // 共鳴分析狀態
  const [toneResonance, setToneResonance] = useState<{
    quality: 'warm' | 'balanced' | 'bright' | 'harsh';
    score: number;
    advice: string;
    centroid: number;
  } | null>(null);

  // 肩膀姿勢狀態
  const [shoulderMetrics, setShoulderMetrics] = useState<ShoulderMetrics | null>(null);

  const [pitchStability, setPitchStability] = useState<number | null>(null);
  const pitchHistory = useRef<number[]>([]);
  const practiceBuffer = useRef<PracticeDataBuffer>(new PracticeDataBuffer());
  const [practiceStability, setPracticeStability] = useState<number>(0);

  useEffect(() => {
    analyzerRef.current = new AudioAnalyzer(1024); // 最快響應速度
    engineRef.current = new AudioEngine();

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // 快捷鍵：Ctrl+Shift+A 開啟練習分析
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAnalyticsDashboard(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
        // Start Audio Context with noise suppression options
        await engineRef.current.init((data, pitch, rms) => {
          if (!micEnabled) return;

          if (rms !== undefined) setCurrentVolume(rms);

          let magnitudes: number[] = [];
          let scaled: number[] = [];

          if (analyzerRef.current && visualizerRef.current) {
            magnitudes = analyzerRef.current.analyze(data);
            scaled = magnitudes.map(m => m * sensitivity);
            visualizerRef.current.draw(scaled);
          }

          if (pitch && pitch > 0) {
            const noteData = getNoteFromFrequency(pitch);
            setCurrentNote(noteData);

            if (engineRef.current?.context) {
              const sampleRate = engineRef.current.context.sampleRate;
              const h = analyzerRef.current?.getHarmonics(pitch, sampleRate);
              if (h) {
                setHarmonics(h);
                // Analyze tone quality and generate suggestion
                const quality = ToneAnalyzer.analyzeToneQuality(h);
                const suggestion = ToneAnalyzer.getSuggestion(h, quality);
                setToneQuality(quality);
                setToneSuggestion(suggestion);
              }

              // 計算頻譜質心（共鳴分析）- 只針對樂器，不包含聲樂
              if (analyzerRef.current && selectedInstrument !== 'vocal' && scaled.length > 0) {
                const centroid = analyzerRef.current.calculateSpectralCentroid(scaled, sampleRate);
                const resonance = analyzerRef.current.analyzeToneResonance(centroid);
                setToneResonance({
                  ...resonance,
                  centroid
                });
              }
            }

            pitchHistory.current.push(pitch);
            if (pitchHistory.current.length > 30) {
              pitchHistory.current.shift();
            }

            const variance = pitchHistory.current.reduce((sum, p) => sum + Math.pow(p - pitch, 2), 0) / pitchHistory.current.length;
            const stability = Math.sqrt(variance);
            setPitchStability(stability);

            // Add pitch point to practice buffer
            if (noteData) {
              const pitchPoint: PitchPoint = {
                frequency: pitch,
                timestamp: Date.now(),
                stability: practiceBuffer.current.calculateLocalStability(practiceBuffer.current.getPitchHistory().length - 1),
                note: noteData.note,
                deviation: noteData.cents
              };
              practiceBuffer.current.addPitchPoint(pitchPoint);
            }

            // Add volume point to practice buffer
            const volumePoint: VolumePoint = {
              level: currentVolume,
              timestamp: Date.now()
            };
            practiceBuffer.current.addVolumePoint(volumePoint);

            // Update practice stability
            const newStability = practiceBuffer.current.calculateStability();
            setPracticeStability(newStability);
          } else {
            pitchHistory.current = [];
            setPitchStability(null);
            setHarmonics(null);
          }
        }, noiseSuppression.enabled ? {
          highPassCutoff: noiseSuppression.highPassCutoff,
          noiseGateThreshold: noiseSuppression.noiseGateThreshold
        } : undefined);
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

  // 如果顯示分析儀表板，渲染覆蓋層
  if (showAnalyticsDashboard) {
    return <SimpleAnalyticsDashboard onClose={() => setShowAnalyticsDashboard(false)} />;
  }

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

            {/* Noise Suppression Controls */}
            <div className="flex items-center gap-2 bg-white/40 rounded-full px-4 py-2 backdrop-blur-md border border-white/30 mr-2">
              <button
                onClick={() => setNoiseSuppression({ ...noiseSuppression, enabled: !noiseSuppression.enabled })}
                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${noiseSuppression.enabled
                  ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                title={`噪音抑制 ${noiseSuppression.enabled ? '開啟' : '關閉'}`}
              >
                🔇
              </button>
              {noiseSuppression.enabled && (
                <>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">濾波</span>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="10"
                      value={noiseSuppression.highPassCutoff}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setNoiseSuppression({ ...noiseSuppression, highPassCutoff: value });
                        if (isStarted && engineRef.current) {
                          engineRef.current.setHighPassCutoff(value);
                        }
                      }}
                      className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      title={`高通濾波器: ${noiseSuppression.highPassCutoff}Hz`}
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-9">{noiseSuppression.highPassCutoff}</span>
                  </div>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">門限</span>
                    <input
                      type="range"
                      min="0.002"
                      max="0.05"
                      step="0.001"
                      value={noiseSuppression.noiseGateThreshold}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setNoiseSuppression({ ...noiseSuppression, noiseGateThreshold: value });
                        if (isStarted && engineRef.current) {
                          engineRef.current.setNoiseGateThreshold(value);
                        }
                      }}
                      className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      title={`噪音門限: ${(noiseSuppression.noiseGateThreshold * 100).toFixed(1)}%`}
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-9">{(noiseSuppression.noiseGateThreshold * 100).toFixed(1)}%</span>
                  </div>
                </>
              )}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-8">

          {/* Left Column (1 col) */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Main Visualizer or Trainer */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>

              <div className="relative bg-white/40 rounded-[2rem] p-4 md:p-6 h-[40vh] min-h-[300px]">
                {mode === 'analysis' ? (
                  <>
                    <div className="absolute top-4 md:top-6 left-6 md:left-8 z-10">
                      <h2 className="text-xl md:text-2xl font-bold text-slate-700">
                        {theme === 'sunset' ? '日落頻譜' : theme === 'ocean' ? '海洋頻譜' : '極光頻譜'}
                      </h2>
                      <p className="text-xs md:text-sm text-slate-400 uppercase tracking-wide">
                        {theme === 'sunset' ? 'Geometric Sunset' : theme === 'ocean' ? 'Deep Ocean' : 'Harmonic Aurora'}
                      </p>
                    </div>

                    {micEnabled ? (
                      <div className="h-full w-full opacity-90 mix-blend-multiply">
                        <Visualizer
                          ref={visualizerRef}
                          theme={theme}
                          pitchHistory={practiceBuffer.current.getPitchHistory()}
                          volumeHistory={practiceBuffer.current.getVolumeHistory()}
                          currentStability={practiceStability}
                          showPracticeOverlay={true}
                        />
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

                {/* Spectrum Info Panel - Bottom Left */}
                {mode === 'analysis' && (
                  <div className="absolute bottom-4 left-4 z-20">
                    <input type="checkbox" id="spectrumInfo" className="peer hidden" />

                    {/* Collapsed State - Icon Button */}
                    <label
                      htmlFor="spectrumInfo"
                      className="peer-checked:hidden flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/40 shadow-lg cursor-pointer hover:bg-white/95 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <span className="text-xs font-bold text-slate-600">頻譜說明</span>
                    </label>

                    {/* Expanded State - Info Panel */}
                    <div className="hidden peer-checked:block bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-white/40 shadow-2xl max-w-xs">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.98 0 13.789" />
                          </svg>
                          極光頻譜解說
                        </h4>
                        <label htmlFor="spectrumInfo" className="cursor-pointer p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </label>
                      </div>

                      <div className="space-y-2 text-xs">
                        {/* Axis Explanation */}
                        <div className="bg-gradient-to-r from-slate-50 to-transparent rounded-lg p-2 border-l-2 border-slate-300">
                          <div className="font-bold text-slate-700 mb-1">📊 座標軸</div>
                          <div className="text-slate-600 space-y-0.5">
                            <div>• <span className="font-semibold">橫軸</span>: 低音 → 高音 (50-4000 Hz)</div>
                            <div>• <span className="font-semibold">高度</span>: 該頻率的音量強度</div>
                          </div>
                        </div>

                        {/* Frequency Ranges */}
                        <div className="bg-gradient-to-r from-emerald-50 to-transparent rounded-lg p-2 border-l-2 border-emerald-400">
                          <div className="font-bold text-emerald-700 mb-1">🟢 左側 (50-500 Hz)</div>
                          <div className="text-slate-600">低音、基頻、環境噪音</div>
                        </div>

                        <div className="bg-gradient-to-r from-cyan-50 to-transparent rounded-lg p-2 border-l-2 border-cyan-400">
                          <div className="font-bold text-cyan-700 mb-1">🔵 中間 (500-2000 Hz)</div>
                          <div className="text-slate-600">直笛/長笛核心音域 ⭐</div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-50 to-transparent rounded-lg p-2 border-l-2 border-purple-400">
                          <div className="font-bold text-purple-700 mb-1">🟣 右側 (2000+ Hz)</div>
                          <div className="text-slate-600">泛音、明亮度、空氣感</div>
                        </div>

                        {/* Tip */}
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 mt-3">
                          <div className="font-bold text-amber-700 mb-1 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                            </svg>
                            提示
                          </div>
                          <div className="text-xs text-amber-800">
                            直笛吹奏時，主要能量應集中在<span className="font-bold">中間區域</span>。若左側過高，請提高噪音濾波器！
                          </div>
                        </div>
                      </div>
                    </div>
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
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-slate-700 mb-1">音準</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Pitch Accuracy</p>
                  </div>
                  <div className={`w-36 h-36 md:w-48 md:h-48 rounded-full bg-gradient-to-tr ${theme === 'sunset' ? 'from-orange-100 to-rose-100' : theme === 'ocean' ? 'from-blue-100 to-teal-100' : 'from-emerald-100 to-cyan-100'} flex items-center justify-center shadow-inner relative mb-2 transition-colors duration-500`}>
                    <span className="text-7xl md:text-8xl font-black text-slate-700 tracking-tighter">
                      {currentNote ? currentNote.note : '--'}
                    </span>
                    {currentNote && (
                      <span className={`absolute -right-2 top-0 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-base font-bold shadow-sm ${Math.abs(currentNote.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {currentNote.cents > 0 ? '+' : ''}{currentNote.cents.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-slate-500 mt-2 bg-white/30 px-5 py-2 rounded-full text-base font-medium">
                    {currentNote ? `${currentNote.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                  </p>
                </div>

                {/* Quality Bars */}
                <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 md:p-8 flex flex-col justify-center shadow-sm flex-1">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-700 mb-1">聲音品質</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Sound Quality</p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white/40 rounded-2xl p-5">
                      <div className="flex justify-between text-base mb-3">
                        <span className="text-slate-600 font-semibold">共鳴度</span>
                        <span className={`font-black text-lg ${theme === 'sunset' ? 'text-orange-600' : 'text-cyan-600'}`}>{harmonics ? (harmonics.score * 100).toFixed(0) : 0}%</span>
                      </div>
                      <div className="h-4 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
                        <div style={{ width: `${harmonics ? (harmonics.score * 100) : 0}%` }} className={`h-full bg-gradient-to-r ${theme === 'sunset' ? 'from-orange-400 to-rose-400' : theme === 'ocean' ? 'from-blue-400 to-teal-400' : 'from-emerald-400 to-cyan-400'} rounded-full transition-all duration-300`}></div>
                      </div>
                    </div>

                    <div className="bg-white/40 rounded-2xl p-5">
                      <div className="flex justify-between text-base mb-3">
                        <span className="text-slate-600 font-semibold">穩定性</span>
                        <span className="font-black text-lg text-indigo-600">{pitchStability ? pitchStability.toFixed(1) : '--'}</span>
                      </div>
                      <div className="h-4 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
                        <div style={{ width: `${Math.max(0, 100 - (pitchStability || 0) * 10)}%` }} className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-300"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>


          {/* Right Column (1 col) */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Camera View */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-2 shadow-sm">
              <div className="flex justify-between items-center px-4 py-2">
                <div>
                  <h3 className="text-base font-bold text-slate-700">
                    {selectedInstrument === 'vocal' ? '嘴型監測' : '演奏姿勢'}
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {selectedInstrument === 'vocal' ? 'Embouchure Cam' : 'Posture Monitor'}
                  </p>
                </div>
                <button
                  onClick={() => setShowCamera(!showCamera)}
                  className={`text-xs px-2 py-1 rounded-full border ${showCamera ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                >
                  {showCamera ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="bg-black/5 rounded-[2rem] overflow-hidden h-[40vh] min-h-[300px] relative">
                {showCamera ? (
                  <CameraView
                    monitoringMode={INSTRUMENT_CONFIGS[selectedInstrument].monitoringMode}
                    onMetricsUpdate={setEmbouchureMetrics}
                    onShoulderMetricsUpdate={setShoulderMetrics}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <span className="text-sm font-medium">相機已暫停</span>
                  </div>
                )}

                {/* Floating Metrics Overlay - Mode Specific */}
                <div className={`absolute bottom-4 left-4 right-4 grid gap-2 ${embouchureMetrics?.mode === 'flute' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {embouchureMetrics?.mode === 'vocal' && embouchureMetrics.vocal && (
                    <>
                      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center">
                        <span className="text-[10px] uppercase text-white/80 font-bold block">開口大小</span>
                        <span className="text-lg font-mono text-white font-medium drop-shadow-md">
                          {embouchureMetrics.vocal.aperture.toFixed(1)}
                        </span>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center">
                        <span className="text-[10px] uppercase text-white/80 font-bold block">嘴巴寬度</span>
                        <span className="text-lg font-mono text-white font-medium drop-shadow-md">
                          {embouchureMetrics.vocal.width.toFixed(1)}
                        </span>
                      </div>
                    </>
                  )}

                  {embouchureMetrics?.mode === 'flute' && embouchureMetrics.flute && (
                    <>
                      <div className={`bg-white/20 backdrop-blur-md rounded-2xl p-3 border ${embouchureMetrics.flute.isTooTight ? 'border-red-400' : 'border-white/30'
                        } text-center`}>
                        <span className="text-[10px] uppercase text-white/80 font-bold block">嘴角狀態</span>
                        <span className={`text-lg font-mono font-medium drop-shadow-md ${embouchureMetrics.flute.isTooTight ? 'text-red-300' : 'text-white'
                          }`}>
                          {embouchureMetrics.flute.isTooTight ? '過緊' : '正常'}
                        </span>
                      </div>
                      <div className={`bg-white/20 backdrop-blur-md rounded-2xl p-3 border ${embouchureMetrics.flute.isTooSmall ? 'border-red-400' : 'border-white/30'
                        } text-center`}>
                        <span className="text-[10px] uppercase text-white/80 font-bold block">嘴型開口</span>
                        <span className={`text-lg font-mono font-medium drop-shadow-md ${embouchureMetrics.flute.isTooSmall ? 'text-red-300' : 'text-white'
                          }`}>
                          {embouchureMetrics.flute.isTooSmall ? '太小' : '正常'}
                        </span>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 text-center">
                        <span className="text-[10px] uppercase text-white/80 font-bold block">上唇張力</span>
                        <span className="text-lg font-mono text-white font-medium drop-shadow-md">
                          {(embouchureMetrics.flute.upperLipTension * 100).toFixed(0)}
                        </span>
                      </div>
                    </>
                  )}

                  {embouchureMetrics?.mode === 'reed' && embouchureMetrics.reed && (
                    <>
                      <div className={`bg-white/20 backdrop-blur-md rounded-2xl p-3 border ${embouchureMetrics.reed.isPuffingCheeks ? 'border-red-400' : 'border-white/30'
                        } text-center`}>
                        <span className="text-[10px] uppercase text-white/80 font-bold block">臉頰狀態</span>
                        <span className={`text-lg font-mono font-medium drop-shadow-md ${embouchureMetrics.reed.isPuffingCheeks ? 'text-red-300' : 'text-white'
                          }`}>
                          {embouchureMetrics.reed.isPuffingCheeks ? '鼓腮' : '正常'}
                        </span>
                      </div>
                      <div className={`bg-white/20 backdrop-blur-md rounded-2xl p-3 border ${embouchureMetrics.reed.isJawTight ? 'border-yellow-400' : 'border-white/30'
                        } text-center`}>
                        <span className="text-[10px] uppercase text-white/80 font-bold block">下顎放鬆</span>
                        <span className={`text-lg font-mono font-medium drop-shadow-md ${embouchureMetrics.reed.isJawTight ? 'text-yellow-300' : 'text-white'
                          }`}>
                          {(embouchureMetrics.reed.jawlineRelaxation * 100).toFixed(0)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 肩膀姿勢狀態（僅長笛模式） */}
            {selectedInstrument === 'flute' && showCamera && shoulderMetrics && (
              <div className="mt-2 px-4 pb-3">
                <div className={`rounded-2xl p-3 border ${shoulderMetrics.isRelaxed
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : 'bg-red-50/80 border-red-200'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {shoulderMetrics.isRelaxed ? '💆' : '⚠️'}
                      </span>
                      <h4 className={`text-sm font-bold ${shoulderMetrics.isRelaxed ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                        肩膀狀態
                      </h4>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${shoulderMetrics.isRelaxed
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                      }`}>
                      {shoulderMetrics.isRelaxed ? '放鬆' : '緊張'}
                    </span>
                  </div>

                  {/* 緊張度進度條 */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>緊張度</span>
                      <span>{Math.round(shoulderMetrics.tensionLevel)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${shoulderMetrics.isRelaxed ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        style={{ width: `${Math.min(100, shoulderMetrics.tensionLevel)}%` }}
                      />
                    </div>
                  </div>

                  {/* 建議 */}
                  {!shoulderMetrics.isRelaxed && (
                    <p className="text-xs text-red-600">
                      💡 {shoulderMetrics.message}
                    </p>
                  )}
                </div>
              </div>
            )}


            {/* Advanced Tone Resonance Panel - 只針對樂器顯示 */}
            {selectedInstrument !== 'vocal' && toneResonance && isStarted && (
              <div className="bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.98 0 13.789" />
                  </svg>
                  口腔共鳴分析
                </h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Oral Cavity Resonance</p>

                {/* Resonance Quality Bar */}
                <div className={`mb-4 p-4 rounded-xl ${toneResonance.quality === 'balanced' ? 'bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200' :
                  toneResonance.quality === 'warm' ? ' bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200' :
                    toneResonance.quality === 'bright' ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200' :
                      'bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">音色品質</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${toneResonance.quality === 'balanced' ? 'bg-emerald-100 text-emerald-700' :
                      toneResonance.quality === 'warm' ? 'bg-cyan-100 text-cyan-700' :
                        toneResonance.quality === 'bright' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                      }`}>
                      {toneResonance.quality === 'balanced' ? '理想 ⭐' :
                        toneResonance.quality === 'warm' ? '溫暖' :
                          toneResonance.quality === 'bright' ? '明亮' : '刺耳'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/50 rounded-full h-3 mb-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${toneResonance.quality === 'balanced' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' :
                        toneResonance.quality === 'warm' ? 'bg-gradient-to-r from-cyan-400 to-blue-400' :
                          toneResonance.quality === 'bright' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                            'bg-gradient-to-r from-red-400 to-pink-400'
                        }`}
                      style={{ width: `${toneResonance.score}%` }}
                    />
                  </div>

                  {/* Advice */}
                  <p className={`text-xs font-medium ${toneResonance.quality === 'balanced' || toneResonance.quality === 'warm' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                    💡 {toneResonance.advice}
                  </p>
                </div>

                {/* Technical Info */}
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200">
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span className="font-bold">頻譜質心</span>
                    <span className="font-mono text-slate-600">{toneResonance.centroid.toFixed(0)} Hz</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    理想範圍: 800-1500 Hz（口腔打開狀態）
                  </div>
                </div>
              </div>
            )}

            {/* Harmonics / Tips - 移到樂器選擇上方 */}
            <div className="bg-gradient-to-b from-white/40 to-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">泛音分析</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Harmonic Analysis</p>
                </div>
                {toneQuality && (
                  <div className="flex items-center gap-1 bg-white/50 px-3 py-1 rounded-full">
                    <span className="text-xs font-bold text-slate-500">品質</span>
                    <span className={`text-lg font-black ${toneQuality.overall >= 80 ? 'text-emerald-500' : toneQuality.overall >= 60 ? 'text-cyan-500' : 'text-amber-500'}`}>
                      {toneQuality.overall}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-center items-end gap-4 h-24 mb-3">
                {[
                  { label: 'F1', val: harmonics?.f1, name: '基頻' },
                  { label: 'F2', val: harmonics?.f2, name: '二次' },
                  { label: 'F3', val: harmonics?.f3, name: '三次' }
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 group">
                    <div className="w-8 bg-white/40 rounded-full relative h-24 flex items-end overflow-hidden p-1 shadow-inner">
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

              {/* Compact Tone Quality */}
              {toneQuality && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/30 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 font-bold">明亮</div>
                    <div className="text-sm font-black text-slate-600">{toneQuality.brightness}%</div>
                  </div>
                  <div className="bg-white/30 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 font-bold">豐富</div>
                    <div className="text-sm font-black text-slate-600">{toneQuality.richness}%</div>
                  </div>
                  <div className="bg-white/30 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 font-bold">平衡</div>
                    <div className="text-sm font-black text-slate-600">{toneQuality.balance}%</div>
                  </div>
                </div>
              )}

              {/* Smart Suggestion */}
              {toneSuggestion ? (
                <div className={`rounded-xl p-3 border ${toneSuggestion.type === 'excellent' ? 'bg-emerald-50 border-emerald-200' :
                  toneSuggestion.type === 'good' ? 'bg-cyan-50 border-cyan-200' :
                    toneSuggestion.type === 'needsWork' ? 'bg-amber-50 border-amber-200' :
                      'bg-rose-50 border-rose-200'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{toneSuggestion.icon}</span>
                    <span className={`text-xs font-bold ${toneSuggestion.type === 'excellent' ? 'text-emerald-600' :
                      toneSuggestion.type === 'good' ? 'text-cyan-600' :
                        toneSuggestion.type === 'needsWork' ? 'text-amber-600' :
                          'text-rose-600'
                      }`}>{toneSuggestion.message}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white/40 rounded-xl p-3 text-center border border-white/30">
                  <p className="text-xs text-slate-500">開始演奏以獲得音色分析</p>
                </div>
              )}
            </div>

            {/* Instrument Selector - 移到泛音分析下方 */}
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-4 md:p-6 shadow-sm">
              <div className="mb-3">
                <h3 className="text-base font-bold text-slate-700 mb-1">樂器選擇</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Instrument</p>
              </div>

              <div className="space-y-2">
                {(Object.keys(INSTRUMENT_CONFIGS) as InstrumentType[]).map((instrument) => {
                  const config = INSTRUMENT_CONFIGS[instrument];
                  const isSelected = selectedInstrument === instrument;
                  return (
                    <button
                      key={instrument}
                      onClick={() => setSelectedInstrument(instrument)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${isSelected
                        ? 'bg-gradient-to-r from-white/80 to-white/60 border-2 border-emerald-400 shadow-md'
                        : 'bg-white/40 hover:bg-white/60 border border-white/30'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.icon} flex items-center justify-center shadow-md`}>
                        <span className="text-white font-black text-[10px]">{config.iconText}</span>
                      </div>
                      <div className="text-left flex-1">
                        <div className={`text-sm font-bold ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>{config.nameChinese}</div>
                      </div>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>



          {/* History Gallery Section */}
          {
            history.length > 0 && (
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
        </div>




        {/* Floating Practice Log Menu Button */}
        <button
          onClick={() => setShowPracticeLog(true)}
          className={`fixed top-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br ${theme === 'sunset' ? 'from-orange-400 to-rose-400' : theme === 'ocean' ? 'from-blue-400 to-teal-400' : 'from-emerald-400 to-cyan-400'} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group animate-float`}
          title="練習日誌"
        >
          <TrebleClefIcon className="w-7 h-7" />
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-rose-400 rounded-full animate-pulse" />
        </button>

        {/* Practice Log Panel */}
        <PracticeLog
          isOpen={showPracticeLog}
          onClose={() => setShowPracticeLog(false)}
          theme={theme}
          currentToneQuality={toneQuality}
        />

        {/* 浮動分析按鈕 */}
        {
          !showPracticeLog && (
            <button
              onClick={() => setShowAnalyticsDashboard(true)}
              className="fixed bottom-6 right-6 z-50 px-6 py-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-2xl hover:shadow-purple-300/50 transition-all transform hover:scale-110 text-sm font-bold flex items-center gap-2"
              title="開啟練習分析 (Ctrl+Shift+A)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              📊 練習分析
            </button>
          )
        }
      </main>
    </div>
  )
}

export default App
