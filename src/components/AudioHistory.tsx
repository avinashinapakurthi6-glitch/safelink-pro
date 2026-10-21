import React, { useState, useEffect, useRef } from 'react';
import { AudioRecord } from '../types';
import { 
  Mic, Volume2, Trash2, Download, AlertCircle, Play, Pause, 
  Calendar, Clock, Disc, Square, ShieldAlert, Sparkles, CheckCircle2,
  HardDrive, RefreshCw, AlertTriangle, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AudioHistoryProps {
  records: AudioRecord[];
  onDeleteRecord: (id: string) => void;
  currentlyPlayingId: string | null;
  onPlayPause: (record: AudioRecord) => void;
  isRecording?: boolean;
  recordingSeconds?: number;
  recordingDurationLimit?: number;
  recordingError?: string | null;
  onStartRecording?: (reason?: string, duration?: number) => void;
  onStopRecording?: () => void;
  defaultDurationSec?: number;
}

export default function AudioHistory({ 
  records, 
  onDeleteRecord, 
  currentlyPlayingId, 
  onPlayPause,
  isRecording = false,
  recordingSeconds = 0,
  recordingDurationLimit = 30,
  recordingError = null,
  onStartRecording,
  onStopRecording,
  defaultDurationSec = 30
}: AudioHistoryProps) {
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [micTesting, setMicTesting] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'sos' | 'manual'>('all');

  // Check microphone permissions on mount
  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermissionState(result.state);
        result.onchange = () => setMicPermissionState(result.state);
      } catch (e) {
        setMicPermissionState('unknown');
      }
    }
  };

  const requestMicAccess = async () => {
    setMicTesting(true);
    setTestNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionState('granted');
      setTestNotice('Microphone hardware connected and permission verified!');
      // Release test stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setMicPermissionState('denied');
      setTestNotice(`Microphone access was denied or unavailable (${err.name || err.message}). Please enable microphone permissions in your device settings.`);
    } finally {
      setMicTesting(false);
    }
  };

  const handleDownload = (record: AudioRecord) => {
    const link = document.createElement('a');
    link.href = record.blobUrl;
    link.download = record.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    if (selectedFilter === 'sos') return r.name.toLowerCase().includes('sos') || r.name.toLowerCase().includes('emergency');
    if (selectedFilter === 'manual') return r.name.toLowerCase().includes('manual') || r.name.toLowerCase().includes('blackbox');
    return true;
  });

  const recordingProgressPercent = Math.min(
    100,
    Math.round((recordingSeconds / (recordingDurationLimit || defaultDurationSec)) * 100)
  );

  return (
    <div className="space-y-5 font-sans">
      
      {/* 1. BLACKBOX RECORDER STATUS & MANUAL RECORD PANEL */}
      <div className="bg-slate-900/45 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isRecording 
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2 font-display">
                SafeLink Blackbox Audio Engine
                {isRecording && (
                  <span className="text-[10px] bg-red-600 text-white font-mono px-2 py-0.5 rounded-full animate-pulse">
                    ● REC ACTIVE
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Continuous ambient sound recording engine for emergency evidence, SOS broadcasts, and offline safety.
              </p>
            </div>
          </div>

          {/* Quick Mic Access / Status Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {micPermissionState === 'granted' ? (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mic Ready
              </span>
            ) : micPermissionState === 'denied' ? (
              <button
                onClick={requestMicAccess}
                className="text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 hover:bg-red-500/20 transition cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Permission Denied (Fix)
              </button>
            ) : (
              <button
                onClick={requestMicAccess}
                disabled={micTesting}
                className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 hover:bg-amber-500/20 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {micTesting ? 'Checking...' : 'Check Mic Access'}
              </button>
            )}
          </div>
        </div>

        {/* ACTIVE RECORDING BANNER */}
        <AnimatePresence>
          {isRecording ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-bold text-red-300 font-mono">
                    RECORDING EVIDENCE IN PROGRESS...
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-red-400">
                  {recordingSeconds}s / {recordingDurationLimit || defaultDurationSec}s
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-rose-400 h-full transition-all duration-300"
                  style={{ width: `${recordingProgressPercent}%` }}
                />
              </div>

              {/* Simulated Waveform Animation */}
              <div className="flex items-center justify-center gap-1 h-6">
                {[12, 24, 16, 28, 20, 32, 18, 26, 14, 30, 22, 16, 28, 12].map((height, i) => (
                  <span
                    key={i}
                    className="w-1 bg-red-400/80 rounded-full animate-pulse"
                    style={{
                      height: `${height}px`,
                      animationDelay: `${(i % 5) * 150}ms`
                    }}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {onStopRecording && (
                  <button
                    onClick={onStopRecording}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/60 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop & Save Audio Log
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-850">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-semibold text-slate-200">
                  Manual Blackbox Ambient Recording
                </p>
                <p className="text-[11px] text-slate-400">
                  Capture {defaultDurationSec} seconds of ambient sound immediately without sounding sirens or triggering SOS alarms.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onStartRecording && (
                  <button
                    onClick={() => onStartRecording('Manual Ambient Evidence', defaultDurationSec)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition flex items-center gap-2 cursor-pointer border border-emerald-400/30"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Record Blackbox Audio Now</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Error notification if recording failed */}
        {recordingError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{recordingError}</span>
          </div>
        )}

        {testNotice && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <span>{testNotice}</span>
            <button 
              onClick={() => setTestNotice(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 2. AUDIO LOGS ARCHIVE */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display">
              Saved Evidence Records ({records.length})
            </h3>
          </div>

          {/* Filter Pills */}
          {records.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                  selectedFilter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({records.length})
              </button>
              <button
                onClick={() => setSelectedFilter('sos')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                  selectedFilter === 'sos'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SOS Alerts
              </button>
              <button
                onClick={() => setSelectedFilter('manual')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                  selectedFilter === 'manual'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manual
              </button>
            </div>
          )}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 p-6 space-y-3">
            <Disc className="w-10 h-10 text-slate-600 animate-spin-slow" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-300">No Audio Logs Found</p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                Audio captures trigger automatically when an SOS alert is launched, or by tapping "Record Blackbox Audio Now" above.
              </p>
            </div>
            {onStartRecording && !isRecording && (
              <button
                onClick={() => onStartRecording('Manual Evidence Capture', defaultDurationSec)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-emerald-400 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record Test Audio</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredRecords.map((record) => {
              const isPlaying = currentlyPlayingId === record.id;
              const isSOSAlert = record.name.toLowerCase().includes('emergency') || record.name.toLowerCase().includes('sos');

              return (
                <div 
                  key={record.id}
                  className={`p-3.5 bg-slate-950/70 border rounded-2xl transition flex items-center justify-between ${
                    isPlaying 
                      ? 'border-emerald-500/50 bg-emerald-950/10' 
                      : 'border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    {/* Play Button */}
                    <button
                      onClick={() => onPlayPause(record)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                        isPlaying 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-950/40' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                      title={isPlaying ? 'Pause Audio' : 'Play Audio'}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-red-400/30" />
                      ) : (
                        <Play className="w-4 h-4 fill-emerald-400/30 translate-x-0.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {record.name}
                        </p>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          isSOSAlert 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 font-bold' 
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {isSOSAlert ? '🚨 SOS Trigger' : '🎙️ Blackbox'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {record.timestamp}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {record.durationSec}s duration
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono">
                          {record.sizeStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Download & Delete */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleDownload(record)}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                      title="Download audio recording"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteRecord(record.id)}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-red-950 rounded-xl text-slate-500 hover:text-red-400 transition cursor-pointer"
                      title="Delete recording"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. HARDWARE & PERMISSION ADVISORY */}
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex gap-3 items-start">
        <Volume2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-[11px] text-slate-400 leading-relaxed">
          <h4 className="font-bold text-slate-300">Encrypted Local Evidence Storage</h4>
          <p>
            Blackbox recordings are securely stored in your browser's persistent IndexedDB storage engine and retained offline. Audio evidence records are never deleted on page reload and can be downloaded as standard playable media at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
