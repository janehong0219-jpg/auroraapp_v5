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


  // Theme & UI
  const [theme] = useState<VisualizerTheme>('aurora');
  const [mode, setMode] = useState<AppMode>('analysis');
  // const [showUsage, setShowUsage] = useState(true);
  const [sensitivity] = useState(1.5);
  const [showPracticeLog, setShowPracticeLog] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>('vocal');
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

  // Toggle Dark Mode Class on Body/HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  // toggleRecording removed as unused


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

  // 共用卡片樣式 - 更清晰、更具實體感但保持柔和
  const cardClass = "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50 rounded-[2rem] transition-all duration-300 hover:shadow-xl hover:border-white/80 dark:hover:border-slate-600";
  const headerClass = "flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3";
  const titleClass = "text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2";
  const subTitleClass = "text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest";

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden text-slate-700 dark:text-slate-300 selection:bg-cyan-200 transition-colors duration-700 ${theme === 'sunset' ? 'bg-[#fff7ed] dark:bg-slate-950' : theme === 'ocean' ? 'bg-[#f0f9ff] dark:bg-slate-950' : 'bg-[#fdfaff] dark:bg-slate-950'
      }`}>

      {/* --- Ambient Background Blobs (Dynamic Theme) - Lower Opacity for cleaner look --- */}
      {theme === 'aurora' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-4000"></div>
        </>
      )}
      {theme === 'sunset' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-rose-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-4000"></div>
        </>
      )}
      {theme === 'ocean' && (
        <>
          <div className="fixed top-0 -left-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob"></div>
          <div className="fixed top-0 -right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-2000"></div>
          <div className="fixed -bottom-20 left-1/2 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 dark:opacity-20 animate-blob animation-delay-4000"></div>
        </>
      )}

      {/* --- Noise Texture --- */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <main className="relative z-10 container mx-auto px-4 md:px-6 py-6 max-w-7xl flex flex-col gap-8 h-full">

        {/* Header Section */}
        <header className={`${cardClass} p-4 flex flex-col md:flex-row justify-between items-center gap-4`}>
          <div className="flex items-center gap-4 pl-2 md:pl-4 w-full md:w-auto">
            {/* Logo Icon */}
            <div className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr shadow-lg ${getThemeGradient()} text-white shrink-0`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 6.97a.75.75 0 011.06 0l2.37 2.37a.75.75 0 01-1.06 1.06l-2.37-2.37a.75.75 11-1.06-1.06l2.37-2.37a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className={`text-2xl font-black bg-gradient-to-r ${getThemeGradient()} bg-clip-text text-transparent`}>Aurora</h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <p className="text-xs text-slate-400 dark:text-slate-500 tracking-widest font-bold">智慧音樂分析</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
            {/* Controls Group */}
            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-full p-1 border border-slate-200 dark:border-slate-700">
              {/* Mode Switcher */}
              <div className="flex bg-white dark:bg-slate-700 rounded-full p-1 shadow-sm border border-slate-100 dark:border-slate-600">
                <button
                  onClick={() => setMode('analysis')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'analysis' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  分析
                </button>
                <button
                  onClick={() => setMode('trainer')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'trainer' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  訓練
                </button>
              </div>

              <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>

              {/* Sensitivity & Noise Controls Simplified */}
              <button
                onClick={() => setNoiseSuppression({ ...noiseSuppression, enabled: !noiseSuppression.enabled })}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${noiseSuppression.enabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}
                title="噪音抑制"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>

            {/* Night Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${darkMode
                ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700'
                : 'bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              title={darkMode ? "切換至日間模式" : "切換至夜間模式"}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              )}
            </button>


            {/* Action Buttons */}
            {!isStarted ? (
              <button
                onClick={handleStart}
                className={`bg-gradient-to-r ${getThemeGradient()} text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:scale-105 transition-all`}
              >
                開始體驗
              </button>
            ) : (
              <button
                onClick={handleSaveSnapshot}
                className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-full text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all shadow-sm"
              >
                儲存紀錄
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        </header>

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pb-8">

          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-8">

            {/* 1. Visualizer Card */}
            <div className={cardClass}>
              <div className="p-6">
                <div className={headerClass}>
                  <div>
                    <h2 className={titleClass}>
                      <span className="w-2 h-6 bg-gradient-to-b from-indigo-400 to-cyan-400 rounded-full"></span>
                      音訊頻譜
                    </h2>
                  </div>
                  <span className={subTitleClass}>Spectrum Analysis</span>
                </div>

                <div className="relative bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 h-[320px]">
                  {mode === 'analysis' ? (
                    <>
                      {micEnabled ? (
                        <div className="h-full w-full">
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
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
                          麥克風已靜音
                        </div>
                      )}
                      {/* Legend Overlay */}
                      <div className="absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {theme} Mode
                      </div>
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
            </div>

            {/* 2. Performance Metrics (Pitch & Quality) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pitch Card */}
              <div className={`${cardClass} p-6`}>
                <div className={headerClass}>
                  <h3 className={titleClass}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-rose-400">
                      <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V5.25a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.658.122z" clipRule="evenodd" />
                    </svg>
                    音準監測
                  </h3>
                  <span className={subTitleClass}>Pitch</span>
                </div>

                <div className="flex flex-col items-center justify-center py-2">
                  <div className={`w-36 h-36 rounded-full bg-gradient-to-b ${Math.abs(currentNote?.deviation || 0) < 5 ? 'from-emerald-50 to-emerald-100 text-emerald-600 dark:from-emerald-900/40 dark:to-emerald-800/20 dark:text-emerald-400' : 'from-slate-50 to-slate-100 text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-400'
                    } flex flex-col items-center justify-center shadow-inner mb-4 relative`}>
                    <span className="text-6xl font-black tracking-tighter">
                      {currentNote ? currentNote.note : '--'}
                    </span>
                    <span className="text-xs font-mono font-bold opacity-60">
                      {currentNote ? `${currentNote.frequency.toFixed(1)} Hz` : '0.0 Hz'}
                    </span>
                    {/* Cent Deviation Indicator */}
                    {currentNote && (
                      <span className={`absolute -top-2 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 text-xs font-bold ${Math.abs(currentNote.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'
                        }`}>
                        {currentNote.cents > 0 ? '+' : ''}{currentNote.cents.toFixed(0)} ct
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${Math.abs(currentNote?.deviation || 0) < 5 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{
                        width: '100%',
                        transform: `translateX(${(currentNote?.deviation || 0) * 2}%) scaleX(0.2)`
                      }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Deviation</p>
                </div>
              </div>

              {/* Quality Card */}
              <div className={`${cardClass} p-6`}>
                <div className={headerClass}>
                  <h3 className={titleClass}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    音質分析
                  </h3>
                  <span className={subTitleClass}>Quality</span>
                </div>

                <div className="space-y-6 pt-2">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">共鳴飽滿度</span>
                      <span className="text-sm font-bold text-blue-500">{harmonics ? (harmonics.score * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${harmonics ? (harmonics.score * 100) : 0}%` }}
                        className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full transition-all duration-500"
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">吹奏穩定性</span>
                      <span className="text-sm font-bold text-indigo-500">{pitchStability ? pitchStability.toFixed(1) : '--'}</span>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(0, 100 - (pitchStability || 0) * 10)}%` }}
                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-300 rounded-full transition-all duration-500"
                      ></div>
                    </div>
                  </div>

                  {toneQuality && (
                    <div className="flex gap-2 pt-2">
                      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 flex-1 text-center">
                        亮度 {toneQuality.brightness}%
                      </div>
                      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 flex-1 text-center">
                        豐富 {toneQuality.richness}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resonance Detail Card (Only for Instruments) */}
            {selectedInstrument !== 'vocal' && toneResonance && isStarted && (
              <div className={`${cardClass} p-6`}>
                <div className={headerClass}>
                  <h3 className={titleClass}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-purple-400">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                    </svg>
                    共鳴詳細
                  </h3>
                  <span className={subTitleClass}>Resonance</span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-black ${toneResonance.quality === 'balanced' ? 'text-emerald-500' :
                        toneResonance.quality === 'warm' ? 'text-blue-500' : 'text-amber-500'
                        }`}>
                        {toneResonance.quality === 'balanced' ? '均衡完美' :
                          toneResonance.quality === 'warm' ? '溫暖厚實' :
                            toneResonance.quality === 'bright' ? '明亮尖銳' : '音色粗糙'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded uppercase">
                        Score: {toneResonance.score}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                      {toneResonance.advice}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-bold uppercase mb-1">Centroid</div>
                    <div className="text-xl font-mono text-slate-700 dark:text-slate-200 font-bold">{toneResonance.centroid.toFixed(0)} Hz</div>
                  </div>
                </div>
              </div>
            )}

          </div>


          {/* Right Column */}
          <div className="lg:col-span-1 flex flex-col gap-8">

            {/* Camera Monitor Card */}
            <div className={`${cardClass} p-6`}>
              <div className={headerClass}>
                <div className="flex items-center gap-3">
                  <h2 className={titleClass}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-emerald-500">
                      <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                    </svg>
                    {selectedInstrument === 'vocal' ? '嘴型監控' : '演奏姿勢'}
                  </h2>
                  <button
                    onClick={() => setShowCamera(!showCamera)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${showCamera ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}
                  >
                    {showCamera ? 'LIVE' : 'OFF'}
                  </button>
                </div>
                <span className={subTitleClass}>Monitor</span>
              </div>

              <div className="relative rounded-3xl overflow-hidden bg-black h-[300px] shadow-inner group">
                {showCamera ? (
                  <>
                    <CameraView
                      monitoringMode={INSTRUMENT_CONFIGS[selectedInstrument].monitoringMode}
                      onMetricsUpdate={setEmbouchureMetrics}
                      onShoulderMetricsUpdate={setShoulderMetrics}
                    />
                    {/* Metrics Overlay inside Camera */}
                    <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                      {embouchureMetrics?.mode === 'vocal' && embouchureMetrics.vocal && (
                        <>
                          <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 min-w-[80px] text-center border border-white/10">
                            <div className="text-[10px] text-white/60 font-bold uppercase mb-1">開口</div>
                            <div className="text-lg text-white font-mono font-bold">{embouchureMetrics.vocal.aperture.toFixed(1)}</div>
                          </div>
                          <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 min-w-[80px] text-center border border-white/10">
                            <div className="text-[10px] text-white/60 font-bold uppercase mb-1">寬度</div>
                            <div className="text-lg text-white font-mono font-bold">{embouchureMetrics.vocal.width.toFixed(1)}</div>
                          </div>
                        </>
                      )}

                      {/* Instrumental Metrics simplified */}
                      {embouchureMetrics?.mode === 'flute' && embouchureMetrics.flute && (
                        <div className={`bg-black/60 backdrop-blur-md rounded-xl p-3 flex-1 border ${embouchureMetrics.flute.isTooTight ? 'border-red-500/50' : 'border-white/10'}`}>
                          <div className="text-[10px] text-white/60 font-bold uppercase mb-1">狀態檢查</div>
                          <div className={`text-sm font-bold ${embouchureMetrics.flute.isTooTight ? 'text-red-400' : 'text-emerald-400'}`}>
                            {embouchureMetrics.flute.isTooTight ? '嘴型過緊' : '放鬆良好'}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                    <span className="text-sm font-bold tracking-widest uppercase">Camera Off</span>
                  </div>
                )}
              </div>

              {/* Posture Advice below Camera */}
              {selectedInstrument === 'flute' && showCamera && shoulderMetrics && !shoulderMetrics.isRelaxed && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">姿勢修正提示</h4>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">{shoulderMetrics.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Instrument Selection Card */}
            <div className={`${cardClass} p-6`}>
              <div className={headerClass}>
                <h3 className={titleClass}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-400">
                    <path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.352 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.291a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.352 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 017.364 0z" clipRule="evenodd" />
                  </svg>
                  樂器模式
                </h3>
                <span className={subTitleClass}>Instrument</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(INSTRUMENT_CONFIGS) as InstrumentType[]).map((instrument) => {
                  const config = INSTRUMENT_CONFIGS[instrument];
                  const isSelected = selectedInstrument === instrument;

                  return (
                    <button
                      key={instrument}
                      onClick={() => setSelectedInstrument(instrument)}
                      className={`relative p-3 rounded-2xl border transition-all duration-200 text-left group ${isSelected
                        ? 'bg-slate-800 border-slate-800 text-white shadow-lg transform scale-[1.02]'
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black mb-2 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                        {config.iconText}
                      </div>
                      <div className="font-bold text-sm">
                        {config.nameChinese}
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 box-shadow-glow"></div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Suggestions Box (Harmonics based) */}
            {toneSuggestion && (
              <div className={`${cardClass} p-6 border-l-4 ${toneSuggestion.type === 'excellent' ? 'border-l-emerald-400' :
                toneSuggestion.type === 'good' ? 'border-l-cyan-400' :
                  toneSuggestion.type === 'needsWork' ? 'border-l-amber-400' : 'border-l-rose-400'
                }`}>
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{toneSuggestion.icon}</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">AI 老師建議</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{toneSuggestion.message}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* History Gallery - Separate Section at Bottom */}
        {history.length > 0 && (
          <div className={`${cardClass} p-8 mb-8`}>
            <div className={headerClass}>
              <h2 className={titleClass}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-slate-400">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                </svg>
                歷史練習紀錄
              </h2>
              <button
                onClick={() => {
                  if (confirm('確定要清除所有歷史紀錄嗎？')) {
                    setHistory([]);
                    localStorage.removeItem('aurora_history');
                  }
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1 rounded-full transition-colors"
              >
                清除全部
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {history.map((item) => (
                <div key={item.id} className="relative group bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                    <button onClick={() => handleDeleteHistoryItem(item.id)} className="text-slate-300 hover:text-rose-500">×</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{item.note.note}</span>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${Math.abs(item.note.deviation) < 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {item.note.cents > 0 ? '+' : ''}{item.note.cents.toFixed(0)} ct
                      </span>
                      <span className="text-[10px] text-slate-400">Score: {(item.harmonicsScore * 100).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Floating Menu Button (kept same but improved shadow) */}
        <button
          onClick={() => setShowPracticeLog(true)}
          className={`fixed top-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl hover:shadow-indigo-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group animate-float`}
          title="練習日誌"
        >
          <TrebleClefIcon className="w-6 h-6" />
        </button>

        {/* Practice Log Panel */}
        <PracticeLog
          isOpen={showPracticeLog}
          onClose={() => setShowPracticeLog(false)}
          theme={theme}
          currentToneQuality={toneQuality}
        />

        {/* 浮動分析按鈕 */}
        {!showPracticeLog && (
          <button
            onClick={() => setShowAnalyticsDashboard(true)}
            className="fixed bottom-6 right-6 z-50 px-6 py-3 rounded-full bg-slate-800 text-white shadow-lg hover:shadow-xl hover:bg-slate-900 transition-all text-sm font-bold flex items-center gap-2"
          >
            <span>📊</span>
            練習分析
          </button>
        )}

      </main>
    </div>
  )
}

export default App
