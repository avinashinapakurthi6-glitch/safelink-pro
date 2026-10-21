import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { isVoiceWakeWordMatch, EMERGENCY_WAKE_WORD } from '../App';
import { 
  Sliders, Mic, Activity, Volume2, Shield, Eye, EyeOff, 
  Smartphone, Check, RefreshCw, AlertTriangle, Play, Square,
  Sparkles, CheckCircle2, XCircle, HelpCircle, Radio, Gauge, Zap,
  Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsConfigProps {
  settings: AppSettings;
  onUpdateSettings: (updated: AppSettings) => void;
  onTriggerSOS?: (reason: string) => void;
  liveDeviceAccel?: number;
  isArmedStandby?: boolean;
  onToggleArmedStandby?: () => void;
  onRequestMotionPermission?: () => Promise<boolean>;
  motionPermissionState?: 'prompt' | 'granted' | 'denied' | 'unsupported';
  isVoiceListening?: boolean;
  onToggleVoiceListening?: () => void;
  voiceAudioLevel?: number;
  voicePermissionState?: 'prompt' | 'granted' | 'denied' | 'unsupported';
  voiceError?: string;
  lastHeardTranscript?: string;
}

const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' }
];

export default function SettingsConfig({
  settings,
  onUpdateSettings,
  onTriggerSOS,
  liveDeviceAccel = 0,
  isArmedStandby = false,
  onToggleArmedStandby,
  onRequestMotionPermission,
  motionPermissionState = 'prompt',
  isVoiceListening = false,
  onToggleVoiceListening,
  voiceAudioLevel = 0,
  voicePermissionState = 'prompt',
  voiceError: globalVoiceError,
  lastHeardTranscript
}: SettingsConfigProps) {
  // Voice Calibration & Testing States
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);
  const [voiceTestTranscript, setVoiceTestTranscript] = useState('');
  const [voiceMatchSuccess, setVoiceMatchSuccess] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const [micVolume, setMicVolume] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  
  const testRecognitionRef = useRef<any>(null);
  const testMicStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Shake Calibration & Real-Time Accelerometer States
  const [isShakeTesting, setIsShakeTesting] = useState(false);
  const [currentLiveAccel, setCurrentLiveAccel] = useState(0);
  const [peakLiveAccel, setPeakLiveAccel] = useState(0);
  const [liveShakeCount, setLiveShakeCount] = useState(0);
  const [shakeTestSuccess, setShakeTestSuccess] = useState(false);
  const [motionSupported, setMotionSupported] = useState(true);
  const lastShakeTimeRef = useRef(0);
  const shakeDecayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save confirmation notification toast
  const [showSavedToast, setShowSavedToast] = useState(false);

  const notifySave = () => {
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
    }
  }, []);

  // Voice Test Sandbox: Speech Recognition Runner for locked "help help"
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isVoiceTesting) {
      setVoiceError('');
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = settings.wakeWordLanguage || 'en-US';

        rec.onresult = (event: any) => {
          const currentTranscript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join(' ')
            .trim()
            .toLowerCase();

          setVoiceTestTranscript(currentTranscript);

          // Strictly test against locked "help help" wake-word
          const isMatch = isVoiceWakeWordMatch(currentTranscript);

          if (isMatch) {
            setVoiceMatchSuccess(true);
            if ('vibrate' in navigator) {
              try { navigator.vibrate([80, 40, 80]); } catch (e) {}
            }
            setTimeout(() => setVoiceMatchSuccess(false), 3000);
          }
        };

        rec.onerror = (e: any) => {
          if (e.error !== 'no-speech') {
            setVoiceError(`Speech service notice: ${e.error}`);
          }
        };

        rec.onend = () => {
          if (isVoiceTesting) {
            try { rec.start(); } catch (e) {}
          }
        };

        rec.start();
        testRecognitionRef.current = rec;
        startMicVisualizer();
      } catch (err: any) {
        setVoiceError('Failed to initialize microphone listener: ' + err.message);
      }
    } else {
      if (testRecognitionRef.current) {
        testRecognitionRef.current.stop();
        testRecognitionRef.current = null;
      }
      stopMicVisualizer();
    }

    return () => {
      if (testRecognitionRef.current) {
        testRecognitionRef.current.stop();
      }
      stopMicVisualizer();
    };
  }, [isVoiceTesting, settings.wakeWordLanguage]);

  // Audio Amplitude Meter
  const startMicVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testMicStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('Mic visualizer unavailable:', e);
    }
  };

  const stopMicVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (testMicStreamRef.current) {
      testMicStreamRef.current.getTracks().forEach(t => t.stop());
      testMicStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicVolume(0);
  };

  // Accelerometer Live Sandbox for Shake-to-SOS
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) {
      setMotionSupported(false);
      return;
    }

    let gravity = { x: 0, y: 0, z: 9.81 };
    let lastTime = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastTime < 35) return;
      lastTime = now;

      let intensity = 0;

      // Method 1: Pure linear acceleration (without gravity)
      if (
        event.acceleration &&
        event.acceleration.x !== null &&
        typeof event.acceleration.x === 'number' &&
        (event.acceleration.x !== 0 || event.acceleration.y !== 0 || event.acceleration.z !== 0)
      ) {
        intensity = Math.hypot(
          event.acceleration.x || 0,
          event.acceleration.y || 0,
          event.acceleration.z || 0
        );
      } 
      // Method 2: Dynamic gravity isolation from accelerationIncludingGravity
      else if (event.accelerationIncludingGravity) {
        const gx = event.accelerationIncludingGravity.x || 0;
        const gy = event.accelerationIncludingGravity.y || 0;
        const gz = event.accelerationIncludingGravity.z || 0;

        const alpha = 0.82;
        gravity.x = alpha * gravity.x + (1 - alpha) * gx;
        gravity.y = alpha * gravity.y + (1 - alpha) * gy;
        gravity.z = alpha * gravity.z + (1 - alpha) * gz;

        const lx = gx - gravity.x;
        const ly = gy - gravity.y;
        const lz = gz - gravity.z;
        intensity = Math.hypot(lx, ly, lz);
      }

      const normalized = Math.round(intensity * 10) / 10;
      setCurrentLiveAccel(normalized);

      if (normalized > peakLiveAccel) {
        setPeakLiveAccel(normalized);
      }

      // Check against configured sensitivity threshold (target default: 50 m/s²)
      if (normalized >= (settings.shakeSensitivity || 50)) {
        if (now - lastShakeTimeRef.current > 180) { // debounce individual peak
          lastShakeTimeRef.current = now;
          setLiveShakeCount(prev => {
            const nextCount = prev + 1;
            const required = settings.shakeCountRequired || 2;
            if (nextCount >= required) {
              setShakeTestSuccess(true);
              if ('vibrate' in navigator) {
                try { navigator.vibrate([150, 50, 150]); } catch (e) {}
              }
              setTimeout(() => setShakeTestSuccess(false), 2500);
              return 0;
            }
            return nextCount;
          });
        }
      }
    };

    if (isShakeTesting) {
      window.addEventListener('devicemotion', handleMotion);
      // Auto-decay shake count if idle for 2.5 seconds
      shakeDecayTimerRef.current = setInterval(() => {
        setLiveShakeCount(prev => (prev > 0 ? prev - 1 : 0));
      }, 2500);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (shakeDecayTimerRef.current) {
        clearInterval(shakeDecayTimerRef.current);
      }
    };
  }, [isShakeTesting, settings.shakeSensitivity, settings.shakeCountRequired, peakLiveAccel]);

  const getSensitivityLabel = (val: number) => {
    if (val <= 25) return { label: 'Light Shake (~2.5 G)', color: 'text-amber-400', desc: 'Triggers with wrist flick. High risk of accidental triggers while walking or moving.' };
    if (val <= 45) return { label: 'Firm Shake (~3.5-4.5 G)', color: 'text-sky-400', desc: 'Firm deliberate shake. Rejects minor hand movements.' };
    if (val <= 55) return { label: '50 m/s² Emergency High-Intensity (~5.1 G) [Recommended]', color: 'text-emerald-400', desc: 'Target emergency calibration. Requires vigorous emergency shaking. Completely eliminates accidental triggers from walking, dropping, or car rides.' };
    return { label: 'Violent / Impact Force (~6-8 G)', color: 'text-red-400', desc: 'Requires extreme physical force. Recommended only for extreme situations.' };
  };

  const sensInfo = getSensitivityLabel(settings.shakeSensitivity);

  return (
    <div className="space-y-6">
      {/* HEADER WITH REALTIME STATUS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-slate-100 font-display">
              Trigger & Hardware Calibration
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure hands-free Web Speech wake-words, calibrate accelerometer force thresholds, and customize anti-accidental safety safeguards.
          </p>
        </div>

        {/* Quick Reset & Saved Indicators */}
        <div className="flex items-center gap-2">
          {showSavedToast && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Settings Saved
            </motion.span>
          )}

          <button
            onClick={() => {
              onUpdateSettings({
                ...settings,
                triggerPhrase: 'help help',
                shakeSensitivity: 50,
                shakeCountRequired: 2,
                voiceSensitivity: 'flexible',
                wakeWordLanguage: 'en-US',
                useSirensOnSOS: false,
                useBeepOnTriggers: true,
                autoRecordDurationSec: 30
              });
              notifySave();
            }}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Reset to recommended safety defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* 1. VOICE TRIGGER & WAKE-WORD CONFIGURATION (WEB SPEECH API) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Voice Command Wake-Word (Locked "help help" Only)
              </h3>
              <p className="text-xs text-slate-400">
                Automatic SOS launch activates exclusively on the double keyphrase <strong className="text-rose-400 font-bold">"help help"</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleVoiceListening && (
              <button
                onClick={onToggleVoiceListening}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isVoiceListening
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-900'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                {isVoiceListening ? 'GUARD ACTIVE (LISTENING)' : 'ENABLE VOICE GUARD'}
              </button>
            )}
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
              speechApiSupported 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {speechApiSupported ? '● Speech API Ready' : '⚠ Limited Browser Support'}
            </span>
          </div>
        </div>

        {/* LOCKED WAKE-WORD SPECIFICATION */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left: Locked Wake Word Rules & Background/Standby Guarantee */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Primary Locked Keyphrase Card */}
            <div className="p-4 bg-slate-950/90 border border-rose-500/30 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Locked Emergency Wake-Word Rule
                </span>
                <span className="text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                  Strictly Locked
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <div>
                    <span className="text-xl font-mono font-black text-white tracking-wider">help help</span>
                    <p className="text-[10px] text-slate-400">Only these two consecutive words activate the trigger</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
                  help help
                </span>
              </div>

              {/* Strict No-Other-Words Notice */}
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-850 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>No Other Words Will Work on This</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  To eliminate accidental false alarms during normal daily conversation, all custom words, presets, and single words (like single <span className="font-mono text-slate-300">"help"</span>) are completely disabled. <strong className="text-slate-200">Only the distinct phrase "help help"</strong> initiates the emergency trigger.
                </p>
              </div>

              {/* Background / Secondary State Rule */}
              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Foreground & Secondary / Background Auto-Launch</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  When the app is opened or not is secondary: SafeLink maintains background audio keepalive and wake-lock so mobile operating systems keep listening. The instant your phone hears <strong className="text-emerald-400">"help help"</strong>, it automatically launches full emergency SOS, alerts your guardians with live GPS, and records blackbox audio.
                </p>
              </div>
            </div>

            {/* Language Locale Selection */}
            <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-2xl border border-slate-850">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  Speech Recognition Dialect / Accent
                </label>
                <span className="text-[10px] text-slate-500">Optimizes detection of "help help"</span>
              </div>
              <select
                value={settings.wakeWordLanguage || 'en-US'}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, triggerPhrase: 'help help', wakeWordLanguage: e.target.value });
                  notifySave();
                }}
                className="w-full text-xs bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl text-slate-200 outline-none focus:border-rose-500/50 transition font-medium"
              >
                {LANGUAGE_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Live Voice Testing Sandbox for "help help" */}
          <div className="md:col-span-5 bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Radio className={`w-3.5 h-3.5 ${isVoiceTesting ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                  "help help" Sandbox Tester
                </span>
                
                <button
                  onClick={() => {
                    setIsVoiceTesting(!isVoiceTesting);
                    setVoiceTestTranscript('');
                    setVoiceMatchSuccess(false);
                  }}
                  disabled={!speechApiSupported}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isVoiceTesting
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-950/40'
                  }`}
                >
                  {isVoiceTesting ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isVoiceTesting ? 'Stop Test' : 'Test "help help"'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Test speaking <strong className="text-rose-400">"help help"</strong> into your microphone safely. See how it triggers instantly while all other words are safely ignored.
              </p>
            </div>

            {/* Audio Waveform / Volume Level */}
            {isVoiceTesting && (
              <div className="space-y-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Mic Input Level</span>
                  <span>{micVolume}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>

                {voiceTestTranscript ? (
                  <div className="text-[11px] font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-500 text-[10px] block">Live Heard Speech:</span>
                    <span className="text-slate-200 font-semibold block">"{voiceTestTranscript}"</span>
                    {!voiceMatchSuccess && (
                      <span className="text-[10px] text-amber-400/80 block">
                        Waiting for locked wake-word: "help help"
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic text-center py-1">
                    Speak into microphone now: say "help help"
                  </p>
                )}
              </div>
            )}

            {/* Match feedback banner */}
            <AnimatePresence>
              {voiceMatchSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl text-center space-y-1"
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    WAKE-WORD "HELP HELP" DETECTED!
                  </div>
                  <p className="text-[10px] text-emerald-300 font-medium">
                    Trigger verification confirmed. In actual mode, this automatically launches full SOS broadcast.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {voiceError && (
              <p className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                {voiceError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. REFINED SHAKE-TO-SOS SENSITIVITY CALIBRATOR */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Shake-to-SOS Force Calibrator
              </h3>
              <p className="text-xs text-slate-400">
                Calibrate the physical force and consecutive shake repetitions required to trigger emergency sequence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
              motionSupported 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {motionSupported ? '● Motion Sensor Ready' : '⚠ Accelerometer Inactive'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left: Physical Force Slider and Safeguard Repetitions */}
          <div className="md:col-span-7 space-y-5">
            {/* Slider with Force Gauge */}
            <div className="space-y-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-850">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  Physical Force Threshold
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {settings.shakeSensitivity} m/s²
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    (~{(settings.shakeSensitivity / 9.81).toFixed(1)} G)
                  </span>
                </div>
              </div>

              {/* Force Range Slider */}
              <input
                type="range"
                min="15"
                max="75"
                step="1"
                value={settings.shakeSensitivity || 50}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, shakeSensitivity: Number(e.target.value) });
                  notifySave();
                }}
                className="w-full accent-amber-500 bg-slate-900 h-2 rounded-lg outline-none cursor-pointer transition"
              />

              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>15 m/s² (LIGHT)</span>
                <span className="text-emerald-400 font-bold">50 m/s² (TARGET EMERGENCY)</span>
                <span>75 m/s² (VIOLENT)</span>
              </div>

              {/* Quick Calibration Presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ ...settings, shakeSensitivity: 50, shakeCountRequired: 2 });
                    notifySave();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                    (settings.shakeSensitivity || 50) === 50
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  🎯 50 m/s² (Target Emergency - Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ ...settings, shakeSensitivity: 35 });
                    notifySave();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                    settings.shakeSensitivity === 35
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  35 m/s² (Firm)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ ...settings, shakeSensitivity: 65 });
                    notifySave();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                    settings.shakeSensitivity === 65
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  65 m/s² (Extreme)
                </button>
              </div>

              {/* Category indicator */}
              <div className="pt-2 border-t border-slate-900 flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
                <div>
                  <span className={`text-xs font-bold ${sensInfo.color}`}>
                    {sensInfo.label}
                  </span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    {sensInfo.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Consecutive Shake Repetitions Filter (Accidental Activation Prevention) */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-850">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-slate-200 block">
                    Consecutive Shakes Filter
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Requires sharp back-and-forth reversal shakes to reject single bumps or drops.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                  {settings.shakeCountRequired || 2} Reversals
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      onUpdateSettings({ ...settings, shakeCountRequired: count });
                      notifySave();
                    }}
                    className={`py-2 text-xs font-bold rounded-xl transition ${
                      (settings.shakeCountRequired || 2) === count
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {count} {count === 1 ? 'Shake' : 'Shakes'}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Standby Guard info card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Phone Pocket & Standby Guard</span>
                </div>
                {onToggleArmedStandby && (
                  <button
                    onClick={onToggleArmedStandby}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      isArmedStandby 
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {isArmedStandby ? '✓ Armed' : 'Arm Standby'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                When Armed Standby is enabled, SafeLink holds a Screen Wake Lock and silent keepalive audio loop so mobile operating systems keep the 50 m/s² accelerometer armed while in your pocket, bag, or transit.
              </p>
            </div>
          </div>

          {/* Right: Live Accelerometer Real-Time Test Meter */}
          <div className="md:col-span-5 bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isShakeTesting ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                  Live Accelerometer Sandbox
                </span>

                <button
                  onClick={() => {
                    setIsShakeTesting(!isShakeTesting);
                    setLiveShakeCount(0);
                    setPeakLiveAccel(0);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isShakeTesting
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold'
                  }`}
                >
                  {isShakeTesting ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isShakeTesting ? 'Stop Test' : 'Calibrate Device'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Shake your phone or laptop in test mode to observe live G-force spikes and tune your ideal threshold safely.
              </p>
            </div>

            {/* Live Readout Gauge */}
            {isShakeTesting ? (
              <div className="space-y-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Current Force</span>
                    <span className="text-sm font-extrabold font-mono text-slate-100">
                      {currentLiveAccel} <span className="text-[10px] text-slate-400">m/s²</span>
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Session Peak</span>
                    <span className="text-sm font-extrabold font-mono text-amber-400">
                      {peakLiveAccel} <span className="text-[10px] text-slate-400">m/s²</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar toward configured threshold */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Force Meter (Target: {settings.shakeSensitivity || 50} m/s²)</span>
                    <span>{Math.min(100, Math.round((currentLiveAccel / (settings.shakeSensitivity || 50)) * 100))}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-75 ${
                        currentLiveAccel >= (settings.shakeSensitivity || 50)
                          ? 'bg-red-500'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, (currentLiveAccel / 75) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Shake Counter Meter */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-medium">Consecutive Shakes:</span>
                  <div className="flex gap-1.5">
                    {Array.from({ length: settings.shakeCountRequired || 2 }).map((_, i) => (
                      <div 
                        key={i}
                        className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${
                          i < liveShakeCount
                            ? 'bg-amber-500 text-slate-950 animate-bounce'
                            : 'bg-slate-850 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-850 text-center space-y-1">
                <Smartphone className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">Sandbox Inactive</p>
                <p className="text-[10px] text-slate-500">
                  Tap "Calibrate Device" above to start live force meter testing.
                </p>
              </div>
            )}

            {/* Test Trigger Banner */}
            <AnimatePresence>
              {shakeTestSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-amber-500/20 border border-amber-500/40 p-2.5 rounded-xl text-center space-y-0.5"
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-amber-400">
                    <CheckCircle2 className="w-4 h-4" />
                    SHAKE TRIGGER VERIFIED!
                  </div>
                  <p className="text-[10px] text-amber-300">
                    Calibration successful ({settings.shakeCountRequired || 2} shakes @ {settings.shakeSensitivity || 50} m/s²).
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 3. BEACON, ACOUSTIC SIREN & HARDWARE PREFERENCES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Siren & Feedback */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
              Acoustic Siren & Beacons
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-850 cursor-pointer group hover:border-slate-800 transition">
              <input
                type="checkbox"
                checked={settings.useSirensOnSOS}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, useSirensOnSOS: e.target.checked });
                  notifySave();
                }}
                className="w-4 h-4 mt-0.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition block">
                  High-Decibel Emergency Siren
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Blasts acoustic pulsing siren during active SOS to scare off attackers. Leave disabled for purely silent SOS.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-850 cursor-pointer group hover:border-slate-800 transition">
              <input
                type="checkbox"
                checked={settings.useBeepOnTriggers}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, useBeepOnTriggers: e.target.checked });
                  notifySave();
                }}
                className="w-4 h-4 mt-0.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition block">
                  Haptic Vibration & Confirmation Tones
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Vibrates device and sounds discrete tone upon detecting gestures, wake-words, or countdown initiation.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Blackbox Duration & Cloak */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
              Blackbox Duration & Cloak
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-300">
                  Blackbox Ambient Audio Recording
                </label>
                <span className="font-mono text-emerald-400 font-bold">
                  {settings.autoRecordDurationSec} Seconds
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="180"
                step="5"
                value={settings.autoRecordDurationSec}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, autoRecordDurationSec: Number(e.target.value) });
                  notifySave();
                }}
                className="w-full accent-emerald-500 bg-slate-950 h-2 rounded-lg outline-none cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>10s (Quick clip)</span>
                <span>60s (Standard)</span>
                <span>180s (Comprehensive)</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Stealth Cloak Disguise Type
              </label>
              <select
                value={settings.decoyType}
                onChange={(e) => {
                  onUpdateSettings({ ...settings, decoyType: e.target.value as 'calculator' | 'news' });
                  notifySave();
                }}
                className="w-full text-xs bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-slate-200 outline-none focus:border-emerald-500/50"
              >
                <option value="calculator">🔢 Daily Calculator Decoy</option>
                <option value="news">📰 Daily Chronicle News Portal Decoy</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance & Interface Theme Switcher */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Appearance & Theme Switcher
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
              Active: {settings.theme === 'light' ? 'Daylight (Light)' : 'OLED Night (Dark)'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Choose between high-contrast OLED Dark Theme for tactical low-glare night operations, or Daylight Light Theme for high-visibility outdoor sunlight clarity.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Dark Theme Button */}
            <button
              type="button"
              onClick={() => {
                onUpdateSettings({ ...settings, theme: 'dark' });
                notifySave();
              }}
              className={`p-3.5 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between gap-2.5 ${
                settings.theme !== 'light'
                  ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-850 hover:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-100">Dark Theme (Night Shield)</span>
                </div>
                {settings.theme !== 'light' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                True OLED dark background for low-light emergencies, battery saving in pockets, and covert surveillance avoidance.
              </p>
            </button>

            {/* Light Theme Button */}
            <button
              type="button"
              onClick={() => {
                onUpdateSettings({ ...settings, theme: 'light' });
                notifySave();
              }}
              className={`p-3.5 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between gap-2.5 ${
                settings.theme === 'light'
                  ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-850 hover:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-100">Light Theme (Daylight Shield)</span>
                </div>
                {settings.theme === 'light' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Crisp high-contrast daylight theme for outdoor readability under direct sunlight and high ambient illumination.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
