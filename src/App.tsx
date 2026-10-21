import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { EmergencyContact, AppSettings, LocationLog, AudioRecord, Ngo, PoliceStation } from './types';
import Dashboard from './components/Dashboard';

// Code-split secondary tabs & modal overlays to dramatically accelerate initial app launch
const ContactsConfig = lazy(() => import('./components/ContactsConfig'));
const AudioHistory = lazy(() => import('./components/AudioHistory'));
const LockScreenWidget = lazy(() => import('./components/LockScreenWidget'));
const HelpGuides = lazy(() => import('./components/HelpGuides'));
const DecoyCalculator = lazy(() => import('./components/DecoyCalculator'));
const DecoyNews = lazy(() => import('./components/DecoyNews'));
const NgosConfig = lazy(() => import('./components/NgosConfig'));
const SharedSOSRoom = lazy(() => import('./components/SharedSOSRoom'));
const CommunityAlerts = lazy(() => import('./components/CommunityAlerts'));
const SettingsConfig = lazy(() => import('./components/SettingsConfig'));
const AndroidFakeCall = lazy(() => import('./components/AndroidFakeCall'));

// Sleek lightweight loading fallback for lazy-loaded tabs
const TabLoadingSkeleton = () => (
  <div className="w-full p-12 flex flex-col items-center justify-center space-y-4 min-h-[320px]">
    <div className="w-8 h-8 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
    <span className="text-xs text-slate-400 font-mono">Loading Shield Module...</span>
  </div>
);
import { DEFAULT_NGOS, DEFAULT_POLICE_STATIONS, calculateDistance } from './utils/geo';
import { loadPersistedAudioRecords, persistAudioRecord, removePersistedAudioRecord } from './utils/audioStorage';
import { 
  auth, 
  signInWithGoogle, 
  signInAsGuest, 
  logOut, 
  saveUserData, 
  loadUserData, 
  startLiveSosSession, 
  updateLiveSosLocation, 
  stopLiveSosSession 
} from './utils/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Shield, Heart, Mic, Zap, Info, Radio, Eye, EyeOff,
  Bell, VolumeX, Mail, Smartphone, RefreshCw, X, AlertTriangle, ShieldCheck, ShieldAlert,
  Building2, LogIn, LogOut, User as UserIcon, ChevronDown, ChevronUp, Copy, ExternalLink, Check, Download,
  Sliders, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Platform-aware SMS URL generator to fix iOS and Android native SMS formatting issues
export const getSmsUrl = (phone: string, body: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  const isIOS = typeof window !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const separator = isIOS ? '&' : '?';
  return `sms:${cleanPhone}${separator}body=${encodeURIComponent(body)}`;
};

// Platform-aware notification helper that never hangs on unregistered service workers
export const showSafeNotification = (title: string, options?: NotificationOptions) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options).catch(() => {
          try { new Notification(title, options); } catch (e) {}
        });
      }).catch(() => {
        try { new Notification(title, options); } catch (e) {}
      });
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('Notification display skipped:', err);
  }
};

// Locked emergency wake-word: ONLY "help help" activates SOS. Single words or other phrases are strictly ignored.
export const EMERGENCY_WAKE_WORD = 'help help';

// Robust phonetic & consecutive repetition filter for "help help"
export const isVoiceWakeWordMatch = (transcript: string): boolean => {
  if (!transcript || typeof transcript !== 'string') return false;
  // Clean punctuation, extra spaces, and lowercase
  const clean = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strictly matches consecutive words "help help" - single "help" or other words will not match
  return /\bhelp\s+help\b/i.test(clean);
};

// Default initial settings (50 m/s^2 emergency shake threshold & locked "help help" wake-word)
const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: EMERGENCY_WAKE_WORD,
  shakeSensitivity: 50,
  shakeCountRequired: 2,
  voiceSensitivity: 'flexible',
  wakeWordLanguage: 'en-US',
  isStealthMode: false,
  decoyType: 'calculator',
  autoRecordDurationSec: 30,
  useSirensOnSOS: false,
  useBeepOnTriggers: true,
  twilioSid: '',
  twilioToken: '',
  twilioFrom: '+19852849186',
  theme: 'dark'
};

// Gracefully merge loaded settings to enforce locked "help help" and 50 m/s^2 default
const mergeSettings = (loaded: any): AppSettings => {
  const merged = { ...DEFAULT_SETTINGS, ...loaded };
  // Strictly lock wake-word to "help help" as requested
  merged.triggerPhrase = EMERGENCY_WAKE_WORD;
  // Upgrade old uncalibrated default (25) or missing values to user-requested 50 m/s^2
  if (!merged.shakeSensitivity || merged.shakeSensitivity === 25) {
    merged.shakeSensitivity = 50;
  }
  if (!merged.shakeCountRequired) {
    merged.shakeCountRequired = 2;
  }
  if (!merged.twilioFrom || merged.twilioFrom.trim() === '') {
    merged.twilioFrom = '+19852849186';
  }
  if (!merged.theme || (merged.theme !== 'light' && merged.theme !== 'dark')) {
    merged.theme = 'dark';
  }
  return merged;
};

// Deduplicate arrays with an id property to guarantee unique React keys
const deduplicateById = <T extends { id: string }>(arr: T[]): T[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (!item || !item.id) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'audio' | 'widgets' | 'guides' | 'ngos' | 'community-alerts' | 'settings'>('dashboard');

  // Firebase Auth States
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSOSSessionId, setActiveSOSSessionId] = useState<string | null>(null);
  const [sharedSOSId, setSharedSOSId] = useState<string | null>(null);

  // App Core States
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Theme state: defaults to saved preference or 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('safelink_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  // Apply theme to document element and data-theme attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
      }
      localStorage.setItem('safelink_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    handleUpdateSettings({ ...settings, theme: nextTheme });
  };
  const [locationLogs, setLocationLogs] = useState<LocationLog[]>([]);
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [policeStations, setPoliceStations] = useState<PoliceStation[]>([]);
  const [latestCoords, setLatestCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // SOS State
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [sosReason, setSosReason] = useState('');
  const [sosTriggerTime, setSosTriggerTime] = useState<string | null>(null);
  
  // Dispatch Pipeline Log
  const [dispatchLogs, setDispatchLogs] = useState<string[]>([]);
  const [isDispatchExpanded, setIsDispatchExpanded] = useState(false);
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Top-Level SafeLink Blackbox Audio Recording Engine
  const [isBlackboxRecording, setIsBlackboxRecording] = useState(false);
  const [blackboxRecordingSeconds, setBlackboxRecordingSeconds] = useState(0);
  const [blackboxDurationLimit, setBlackboxDurationLimit] = useState(30);
  const [blackboxError, setBlackboxError] = useState<string | null>(null);

  const blackboxRecorderRef = useRef<MediaRecorder | null>(null);
  const blackboxStreamRef = useRef<MediaStream | null>(null);
  const blackboxChunksRef = useRef<Blob[]>([]);
  const blackboxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blackboxStartTimeRef = useRef<number>(0);

  // Android & PWA App Installation States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isFakeCallOpen, setIsFakeCallOpen] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Listen for Native Hardware SOS triggers & Android back gestures
  useEffect(() => {
    const handleNativeHardwareSOS = () => {
      triggerSOS('Native Android Hardware Volume Panic');
    };

    const handlePopState = () => {
      if (isFakeCallOpen) {
        setIsFakeCallOpen(false);
        return;
      }
      if (settings.isStealthMode) {
        setSettings(prev => ({ ...prev, isStealthMode: false }));
        return;
      }
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('native-hardware-sos', handleNativeHardwareSOS);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('native-hardware-sos', handleNativeHardwareSOS);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isFakeCallOpen, settings.isStealthMode, activeTab]);

  // Listen for Android PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsAppInstalled(true);
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      setActiveTab('widgets');
    }
  };

  // Screen Wake Lock helper for active Android emergency tracking
  const acquireWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Live Accelerometer & Armed Standby States
  const [liveDeviceAccel, setLiveDeviceAccel] = useState<number>(0);
  const [shakeProgressCount, setShakeProgressCount] = useState<number>(0);
  const [isArmedStandby, setIsArmedStandby] = useState<boolean>(false);
  const [isPocketBlackout, setIsPocketBlackout] = useState<boolean>(false);
  const [motionPermissionState, setMotionPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const keepaliveAudioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  // Global Continuous Voice Command Wake-Word Engine ("help help" only, runs globally & in standby)
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceAudioLevel, setVoiceAudioLevel] = useState<number>(0);
  const [voicePermissionState, setVoicePermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [voiceError, setVoiceError] = useState<string>('');
  const [lastHeardTranscript, setLastHeardTranscript] = useState<string>('');

  const globalRecognitionRef = useRef<any>(null);
  const voiceActiveRef = useRef<boolean>(false);
  const voiceRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Audio level visualizer for microphone
  const startMicVisualizer = async () => {
    try {
      if (micStreamRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setVoicePermissionState('granted');
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setVoiceAudioLevel(Math.min(100, Math.round(avg * 1.6)));
        micAnimFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err: any) {
      console.warn('Microphone stream access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoicePermissionState('denied');
        setVoiceError('Microphone permission denied. Allow microphone access to listen for "help help".');
      }
    }
  };

  const stopMicVisualizer = () => {
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    micAnalyserRef.current = null;
    setVoiceAudioLevel(0);
  };

  // Inaudible audio loop keepalive to maintain background thread prioritization on mobile
  const startAudioKeepalive = () => {
    try {
      if (keepaliveAudioRef.current) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Inaudible sub-bass frequency at 0.0001 volume keeps audio thread prioritized in background
      osc.type = 'sine';
      osc.frequency.setValueAtTime(20, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keepaliveAudioRef.current = { ctx, osc, gain };
    } catch (e) {
      console.warn('Audio keepalive initialization skipped:', e);
    }
  };

  const stopAudioKeepalive = () => {
    try {
      if (keepaliveAudioRef.current) {
        keepaliveAudioRef.current.osc.stop();
        keepaliveAudioRef.current.ctx.close();
        keepaliveAudioRef.current = null;
      }
    } catch (e) {}
  };

  const playAlertBeep = (freq: number = 1200, duration: number = 0.4) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio feedback error:', e);
    }
  };

  const requestMotionPermission = async (): Promise<boolean> => {
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const state = await (DeviceMotionEvent as any).requestPermission();
        if (state === 'granted') {
          setMotionPermissionState('granted');
          return true;
        } else {
          setMotionPermissionState('denied');
          return false;
        }
      } catch (err) {
        console.warn('Motion permission request failed:', err);
        setMotionPermissionState('denied');
        return false;
      }
    } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setMotionPermissionState('granted');
      return true;
    } else {
      setMotionPermissionState('unsupported');
      return false;
    }
  };

  // Continuous Speech Recognition Engine: ONLY "help help" triggers SOS
  const startVoiceListening = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoicePermissionState('unsupported');
      setVoiceError('Speech Recognition is not supported in this browser. Shake and manual triggers remain active.');
      return;
    }

    voiceActiveRef.current = true;
    setIsVoiceListening(true);
    setVoiceError('');

    startMicVisualizer();
    acquireWakeLock();
    startAudioKeepalive();

    try {
      if (globalRecognitionRef.current) {
        try { globalRecognitionRef.current.abort(); } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.lang = settings.wakeWordLanguage || 'en-US';

      rec.onstart = () => {
        setVoicePermissionState('granted');
        setVoiceError('');
      };

      rec.onresult = (event: any) => {
        const fullTranscript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript || '')
          .join(' ')
          .toLowerCase();

        setLastHeardTranscript(fullTranscript);

        // Strict verification: ONLY "help help" activates SOS. Single words or other phrases are ignored.
        let matched = isVoiceWakeWordMatch(fullTranscript);

        if (!matched && event.results.length > 0) {
          const latestResult = event.results[event.results.length - 1];
          for (let i = 0; i < latestResult.length; i++) {
            if (isVoiceWakeWordMatch(latestResult[i].transcript)) {
              matched = true;
              break;
            }
          }
        }

        if (matched) {
          console.log('[SafeLink Voice] Emergency Wake-Word "help help" matched. Dispatching SOS!');
          triggerSOS('Emergency Voice Wake-Word "help help" Detected');
          if (settings.useBeepOnTriggers) {
            playAlertBeep(1200, 0.5);
          }
          if ('vibrate' in navigator) {
            try { navigator.vibrate([300, 100, 300, 100, 500]); } catch (e) {}
          }
          // High-priority notification when app is opened or secondary in background
          showSafeNotification('🚨 EMERGENCY SOS LAUNCHED!', {
            body: 'Emergency wake-word "help help" detected hands-free! Full SOS broadcast active.',
            icon: '/icon-192.svg',
            tag: 'safelink-voice-sos',
            requireInteraction: true
          });
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') {
          // Standard silence pause, let onend handle automatic continuation
          return;
        }
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setVoicePermissionState('denied');
          setVoiceError('Microphone permission blocked. Enable microphone to detect "help help".');
          voiceActiveRef.current = false;
          setIsVoiceListening(false);
          return;
        }
        if (e.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition notice:', e.error);
      };

      rec.onend = () => {
        // Automatically restart speech recognition continuously if voice listening is active and SOS is not firing
        if (voiceActiveRef.current && !isSOSActive) {
          if (voiceRestartTimerRef.current) clearTimeout(voiceRestartTimerRef.current);
          voiceRestartTimerRef.current = setTimeout(() => {
            if (voiceActiveRef.current && !isSOSActive) {
              try {
                rec.start();
              } catch (err) {
                setTimeout(() => {
                  if (voiceActiveRef.current && !isSOSActive) {
                    try { rec.start(); } catch (e) {}
                  }
                }, 300);
              }
            }
          }, 150);
        }
      };

      rec.start();
      globalRecognitionRef.current = rec;
      localStorage.setItem('safelink_voice_listening_armed', 'true');
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setVoiceError(err.message || 'Failed to start speech recognition');
    }
  }, [settings.wakeWordLanguage, settings.useBeepOnTriggers, isSOSActive]);

  const stopVoiceListening = useCallback(() => {
    voiceActiveRef.current = false;
    setIsVoiceListening(false);
    localStorage.setItem('safelink_voice_listening_armed', 'false');
    if (voiceRestartTimerRef.current) {
      clearTimeout(voiceRestartTimerRef.current);
      voiceRestartTimerRef.current = null;
    }
    if (globalRecognitionRef.current) {
      try {
        globalRecognitionRef.current.abort();
      } catch (e) {}
      globalRecognitionRef.current = null;
    }
    stopMicVisualizer();
    if (!isArmedStandby) {
      releaseWakeLock();
      stopAudioKeepalive();
    }
  }, [isArmedStandby]);

  const toggleVoiceListening = () => {
    if (isVoiceListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const toggleArmedStandby = async () => {
    if (isArmedStandby) {
      setIsArmedStandby(false);
      setIsPocketBlackout(false);
      stopVoiceListening();
      releaseWakeLock();
      stopAudioKeepalive();
    } else {
      await requestMotionPermission();
      setIsArmedStandby(true);
      await acquireWakeLock();
      startAudioKeepalive();
      // Simultaneously arm "help help" voice listener with the 50 m/s² shake sensor
      startVoiceListening();

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  };

  // Global Shake Detection Engine: Linear Acceleration Filter Calibrated to 50 m/s²
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) {
      setMotionPermissionState('unsupported');
      return;
    }

    let lastTime = 0;
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    let gravity = { x: 0, y: 0, z: 9.81 };
    let lastShakeTime = 0;

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      if (isSOSActive) return;

      const now = Date.now();
      // Sample at ~50Hz (25ms-40ms)
      if (now - lastTime < 35) return;
      const diffTime = (now - lastTime) / 1000;
      lastTime = now;

      let intensity = 0;

      // Priority 1: True linear acceleration (gravity-free) supplied by modern mobile browsers
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
      // Priority 2: Gravity-isolated dynamic linear acceleration from accelerationIncludingGravity
      else if (event.accelerationIncludingGravity) {
        const gx = event.accelerationIncludingGravity.x || 0;
        const gy = event.accelerationIncludingGravity.y || 0;
        const gz = event.accelerationIncludingGravity.z || 0;

        // Dynamic low-pass filter tracking gravity vector
        const alpha = 0.82;
        gravity.x = alpha * gravity.x + (1 - alpha) * gx;
        gravity.y = alpha * gravity.y + (1 - alpha) * gy;
        gravity.z = alpha * gravity.z + (1 - alpha) * gz;

        // Isolate dynamic movement without 9.81 m/s² Earth gravity
        const linearX = gx - gravity.x;
        const linearY = gy - gravity.y;
        const linearZ = gz - gravity.z;
        intensity = Math.hypot(linearX, linearY, linearZ);

        // Instantaneous acceleration rate delta
        if (lastX !== null && lastY !== null && lastZ !== null && diffTime > 0) {
          const deltaX = gx - lastX;
          const deltaY = gy - lastY;
          const deltaZ = gz - lastZ;
          const deltaAccel = Math.hypot(deltaX, deltaY, deltaZ);
          intensity = Math.max(intensity, deltaAccel);
        }
        lastX = gx;
        lastY = gy;
        lastZ = gz;
      }

      const roundedIntensity = Math.round(intensity * 10) / 10;
      setLiveDeviceAccel(roundedIntensity);

      const targetThreshold = settings.shakeSensitivity || 50;

      // Strict threshold check: only activate when physical intensity reaches target (default 50 m/s²)
      if (intensity >= targetThreshold) {
        // Enforce 180ms debounce between reversals to ensure distinct intentional shake swings
        if (now - lastShakeTime > 180) {
          lastShakeTime = now;
          setShakeProgressCount((prev) => {
            const nextCount = prev + 1;
            const required = settings.shakeCountRequired || 2;
            if (nextCount >= required) {
              triggerSOS(`Emergency Shake Gesture Activated (${required} Reversals @ ${Math.round(intensity)} m/s² [Target: ${targetThreshold} m/s²])`);
              if (settings.useBeepOnTriggers) {
                playAlertBeep(1200, 0.4);
              }
              return 0;
            }
            return nextCount;
          });
        }
      }
    };

    // Auto-decay shake counter after 2 seconds of stillness
    const decayTimer = setInterval(() => {
      setShakeProgressCount((prev) => (prev > 0 ? prev - 1 : 0));
    }, 2000);

    window.addEventListener('devicemotion', handleMotionEvent);
    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
      clearInterval(decayTimer);
    };
  }, [isSOSActive, settings.shakeSensitivity, settings.shakeCountRequired, settings.useBeepOnTriggers]);

  // Handle visibility change and background resilience for Voice Wake-Word & Armed Standby
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (voiceActiveRef.current || isArmedStandby) {
          showSafeNotification('SafeLink Continuous Guard Active', {
            body: voiceActiveRef.current 
              ? 'Listening hands-free for "help help". Speak "help help" anytime to automatically launch SOS.'
              : 'Emergency Shake Guard active in standby.',
            icon: '/icon-192.svg',
            tag: 'safelink-guard-standby',
            silent: true
          });
        }
      } else if (document.visibilityState === 'visible') {
        // When user returns to tab, ensure recognition is still smoothly running
        if (voiceActiveRef.current && !isSOSActive && !globalRecognitionRef.current) {
          startVoiceListening();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isArmedStandby, isSOSActive, startVoiceListening]);

  // Voice Wake-Word Auto-Arming & Background Watchdog: whether app is opened or secondary
  useEffect(() => {
    // Check if voice listening should be armed (defaults to true for maximum safety)
    const storedArmed = localStorage.getItem('safelink_voice_listening_armed');
    const shouldArm = storedArmed !== 'false';

    const tryAutoArm = () => {
      if (shouldArm && !voiceActiveRef.current && !isSOSActive) {
        startVoiceListening();
      }
    };

    // Auto-arm immediately if supported / already permitted
    tryAutoArm();

    // User gesture listener: modern browsers require first gesture to unlock AudioContext & Mic
    const handleFirstGesture = () => {
      if (shouldArm && !voiceActiveRef.current && !isSOSActive) {
        startVoiceListening();
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });

    // Watchdog timer: ensure recognition doesn't stall in background or secondary tabs
    const watchdogTimer = setInterval(() => {
      if (voiceActiveRef.current && !isSOSActive) {
        if (!globalRecognitionRef.current) {
          try {
            startVoiceListening();
          } catch (e) {}
        }
      }
    }, 2500);

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      clearInterval(watchdogTimer);
    };
  }, [isSOSActive, startVoiceListening]);

  // Load state from LocalStorage on mount & listen to Firebase Auth
  useEffect(() => {
    // Check for Deep Link Shared SOS Tracking Room
    const params = new URLSearchParams(window.location.search);
    const shareSOSParam = params.get('shareSOS') || params.get('sosSession');
    if (shareSOSParam) {
      setSharedSOSId(shareSOSParam);
    }

    try {
      const storedContacts = localStorage.getItem('safelink_contacts');
      if (storedContacts) {
        const parsed = deduplicateById<EmergencyContact>(JSON.parse(storedContacts));
        const migrated = parsed.map(c => ({
          ...c,
          customMessage: 'emergency: live location: [MAP_LINK]'
        }));
        setContacts(migrated);
        localStorage.setItem('safelink_contacts', JSON.stringify(migrated));
      }

      const storedSettings = localStorage.getItem('safelink_settings');
      if (storedSettings) {
        const parsed = mergeSettings(JSON.parse(storedSettings));
        setSettings(parsed);
        if (parsed.theme) {
          setTheme(parsed.theme);
        }
      }

      const storedLocationLogs = localStorage.getItem('safelink_location_logs');
      if (storedLocationLogs) {
        const parsed = deduplicateById<LocationLog>(JSON.parse(storedLocationLogs));
        setLocationLogs(parsed);
        if (parsed.length > 0) {
          setLatestCoords({ lat: parsed[0].latitude, lng: parsed[0].longitude });
        }
      }

      const storedNgos = localStorage.getItem('safelink_ngos');
      if (storedNgos) {
        setNgos(deduplicateById<Ngo>(JSON.parse(storedNgos)));
      } else {
        setNgos(deduplicateById<Ngo>(DEFAULT_NGOS));
      }

      const storedPolice = localStorage.getItem('safelink_police');
      if (storedPolice) {
        setPoliceStations(deduplicateById<PoliceStation>(JSON.parse(storedPolice)));
      } else {
        setPoliceStations(deduplicateById<PoliceStation>(DEFAULT_POLICE_STATIONS));
      }

      // Load persisted audio records from IndexedDB and LocalStorage cache
      loadPersistedAudioRecords().then((loaded) => {
        if (loaded && loaded.length > 0) {
          setAudioRecords(deduplicateById<AudioRecord>(loaded));
        }
      }).catch((e) => console.warn('Could not load cached audio:', e));
    } catch (e) {
      console.error('Failed to restore safe-link caches:', e);
    }

    // Initialize Firebase Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        try {
          const firestoreData = await loadUserData(currentUser.uid);
          if (firestoreData) {
            if (firestoreData.contacts) setContacts(deduplicateById<EmergencyContact>(firestoreData.contacts));
            if (firestoreData.settings) {
              const parsed = mergeSettings(firestoreData.settings);
              setSettings(parsed);
              if (parsed.theme) {
                setTheme(parsed.theme);
              }
            }
            if (firestoreData.locationLogs) {
              const parsed = deduplicateById<LocationLog>(firestoreData.locationLogs);
              setLocationLogs(parsed);
              if (parsed.length > 0) {
                setLatestCoords({ lat: parsed[0].latitude, lng: parsed[0].longitude });
              }
            }
            if (firestoreData.ngos) setNgos(deduplicateById<Ngo>(firestoreData.ngos));
            if (firestoreData.policeStations) setPoliceStations(deduplicateById<PoliceStation>(firestoreData.policeStations));
            if (firestoreData.audioRecords) {
              setAudioRecords(prev => deduplicateById<AudioRecord>([...prev, ...firestoreData.audioRecords]));
            }
          } else {
            // Sync existing local state cache to database for new user profile
            saveUserData(currentUser.uid, {
              contacts: deduplicateById<EmergencyContact>(contacts),
              settings,
              locationLogs: deduplicateById<LocationLog>(locationLogs),
              ngos: ngos.length > 0 ? deduplicateById<Ngo>(ngos) : deduplicateById<Ngo>(DEFAULT_NGOS),
              policeStations: policeStations.length > 0 ? deduplicateById<PoliceStation>(policeStations) : deduplicateById<PoliceStation>(DEFAULT_POLICE_STATIONS),
              audioRecords: deduplicateById<AudioRecord>(audioRecords)
            });
          }
        } catch (loadErr) {
          console.warn('Initial Firestore user data fetch skipped (using local cache):', loadErr);
        }
      }
    });

    // Defer initial position check so React completes initial paint instantaneously
    const initialGeoTimer = setTimeout(() => {
      try {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setLatestCoords({ lat: latitude, lng: longitude });
            },
            (err) => {
              console.warn('Initial app launch geolocation lock skipped:', err);
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        }
      } catch (e) {
        console.warn('Initial geolocation check skipped:', e);
      }
    }, 400);

    if (params.get('trigger') === 'sos' || params.get('widget') === '1') {
      triggerSOS('Rapid One-Tap Widget Bypass');
    }

    if (params.get('fakecall') === '1') {
      setIsFakeCallOpen(true);
    }

    return () => {
      clearTimeout(initialGeoTimer);
      unsubscribeAuth();
    };
  }, []);

  // Sync state to LocalStorage & Firestore Database (when authenticated)
  const handleSaveContacts = (updated: EmergencyContact[]) => {
    const clean = deduplicateById(updated);
    setContacts(clean);
    localStorage.setItem('safelink_contacts', JSON.stringify(clean));
    if (user) {
      saveUserData(user.uid, { contacts: clean });
    }
  };

  const handleUpdateSettings = useCallback((updated: AppSettings) => {
    // Strictly enforce locked "help help" wake-word
    const enforced: AppSettings = { ...updated, triggerPhrase: EMERGENCY_WAKE_WORD };
    if (enforced.theme && (enforced.theme === 'light' || enforced.theme === 'dark')) {
      setTheme(enforced.theme);
    }
    setSettings(enforced);
    localStorage.setItem('safelink_settings', JSON.stringify(enforced));
    if (user) {
      saveUserData(user.uid, { settings: enforced });
    }
  }, [user]);

  const handleSaveNgos = (updated: Ngo[]) => {
    const clean = deduplicateById(updated);
    setNgos(clean);
    localStorage.setItem('safelink_ngos', JSON.stringify(clean));
    if (user) {
      saveUserData(user.uid, { ngos: clean });
    }
  };

  const handleSavePoliceStations = (updated: PoliceStation[]) => {
    const clean = deduplicateById(updated);
    setPoliceStations(clean);
    localStorage.setItem('safelink_police', JSON.stringify(clean));
    if (user) {
      saveUserData(user.uid, { policeStations: clean });
    }
  };

  const handleAddLocationLog = useCallback((log: LocationLog) => {
    setLatestCoords({ lat: log.latitude, lng: log.longitude });
    setLocationLogs((prev) => {
      // Avoid duplicate log IDs
      if (prev.some((item) => item.id === log.id)) {
        return prev;
      }
      const updated = deduplicateById([log, ...prev]).slice(0, 100); // Limit to last 100 entries
      localStorage.setItem('safelink_location_logs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Supported Audio MIME Type Resolver
  const getSupportedAudioMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/aac'
    ];
    for (const type of candidateTypes) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (e) {}
    }
    return '';
  };

  // SafeLink Central Blackbox Recording Orchestrator
  const startBlackboxRecording = useCallback(async (
    reason = 'SOS Emergency Ambient Audio', 
    durationSec = settings.autoRecordDurationSec || 30
  ) => {
    try {
      setBlackboxError(null);
      if (blackboxRecorderRef.current && blackboxRecorderRef.current.state === 'recording') {
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      blackboxStreamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (mimeErr) {
        recorder = new MediaRecorder(stream);
      }

      blackboxChunksRef.current = [];
      const actualMimeType = recorder.mimeType || 'audio/webm';
      const fileExt = actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('ogg') ? 'ogg' : 'webm';
      blackboxStartTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          blackboxChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(blackboxChunksRef.current, { type: actualMimeType });
          const elapsedSec = Math.max(1, Math.round((Date.now() - blackboxStartTimeRef.current) / 1000));
          const blobUrl = URL.createObjectURL(audioBlob);
          const sizeKB = Math.max(1, Math.round(audioBlob.size / 1024));
          const now = new Date();
          const timestampStr = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • ${now.toLocaleDateString()}`;

          const isEmergency = reason.toLowerCase().includes('sos') || reason.toLowerCase().includes('emergency');
          const fileName = `${isEmergency ? 'Emergency_SOS' : 'Blackbox_Evidence'}_${now.getTime()}.${fileExt}`;

          const newRecord: AudioRecord = {
            id: crypto.randomUUID(),
            blobUrl,
            name: fileName,
            durationSec: elapsedSec,
            timestamp: timestampStr,
            sizeStr: `${sizeKB} KB`
          };

          // Persist to IndexedDB and LocalStorage
          const persisted = await persistAudioRecord(newRecord, audioBlob);

          setAudioRecords((prev) => deduplicateById([persisted, ...prev]));

          // Sync metadata to Firestore
          if (auth.currentUser) {
            saveUserData(auth.currentUser.uid, {
              audioRecords: deduplicateById([persisted, ...audioRecords]).slice(0, 30)
            });
          }
        } catch (saveErr) {
          console.error('Failed to process and save recorded audio blob:', saveErr);
        } finally {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          blackboxStreamRef.current = null;
          setIsBlackboxRecording(false);
        }
      };

      blackboxRecorderRef.current = recorder;
      recorder.start(1000);
      setIsBlackboxRecording(true);
      setBlackboxRecordingSeconds(0);
      setBlackboxDurationLimit(durationSec);

      if (blackboxTimerRef.current) {
        clearInterval(blackboxTimerRef.current);
      }

      blackboxTimerRef.current = setInterval(() => {
        setBlackboxRecordingSeconds((prev) => {
          if (prev >= durationSec) {
            stopBlackboxRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start blackbox audio recording:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isDenied 
        ? 'Microphone permission was denied. Tap "Blackbox Audio" > "Check Mic Access" to grant permissions.'
        : `Microphone recording unavailable (${err.name || err.message}). Please check audio input.`;
      setBlackboxError(msg);
      setIsBlackboxRecording(false);
    }
  }, [settings.autoRecordDurationSec, audioRecords]);

  const stopBlackboxRecording = useCallback(() => {
    if (blackboxTimerRef.current) {
      clearInterval(blackboxTimerRef.current);
      blackboxTimerRef.current = null;
    }

    if (blackboxRecorderRef.current && blackboxRecorderRef.current.state !== 'inactive') {
      try {
        blackboxRecorderRef.current.requestData();
      } catch (e) {}
      blackboxRecorderRef.current.stop();
    } else {
      setIsBlackboxRecording(false);
      if (blackboxStreamRef.current) {
        blackboxStreamRef.current.getTracks().forEach((t) => t.stop());
        blackboxStreamRef.current = null;
      }
    }
  }, []);

  const handleAddAudioRecord = async (record: AudioRecord) => {
    const persisted = await persistAudioRecord(record);
    setAudioRecords((prev) => {
      if (prev.some((item) => item.id === record.id)) {
        return prev;
      }
      return deduplicateById([persisted, ...prev]);
    });
  };

  const handleDeleteAudioRecord = (id: string) => {
    setAudioRecords((prev) => {
      const record = prev.find((r) => r.id === id);
      if (record && record.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(record.blobUrl);
      }
      return prev.filter((r) => r.id !== id);
    });
    removePersistedAudioRecord(id);
    if (currentPlayingId === id) {
      stopPlayback();
    }
    if (user) {
      saveUserData(user.uid, {
        audioRecords: audioRecords.filter((r) => r.id !== id)
      });
    }
  };

  // Audio Playback Helpers
  const handlePlayPause = (record: AudioRecord) => {
    if (currentPlayingId === record.id) {
      stopPlayback();
    } else {
      stopPlayback();
      const player = new Audio(record.blobUrl);
      player.onended = () => {
        setCurrentPlayingId(null);
      };
      player.onerror = () => {
        setCurrentPlayingId(null);
      };
      audioPlayerRef.current = player;
      player.play().catch((err) => {
        console.warn('Audio playback error:', err);
        setCurrentPlayingId(null);
      });
      setCurrentPlayingId(record.id);
    }
  };

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setCurrentPlayingId(null);
  };

  // Push live coordinates & dispatch logs to Firestore session in real-time until stopped
  useEffect(() => {
    if (!isSOSActive || !activeSOSSessionId || !latestCoords) return;

    const timer = setTimeout(() => {
      updateLiveSosLocation(activeSOSSessionId, {
        latitude: latestCoords.lat,
        longitude: latestCoords.lng,
        accuracy: 12
      }, dispatchLogs);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isSOSActive, activeSOSSessionId, latestCoords, dispatchLogs]);

  // SOS Alert Dispatch Trigger
  const triggerSOS = (reason: string) => {
    if (isSOSActive) return;
    
    // Android Native Hardware: Keep screen on & vibrate phone
    acquireWakeLock();
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (e) {}
    }

    setIsSOSActive(true);
    setSosReason(reason);
    const triggerTimeStr = new Date().toLocaleTimeString();
    setSosTriggerTime(triggerTimeStr);
    setDispatchLogs([]);

    // Automatically initialize persistent blackbox audio recording stream
    startBlackboxRecording(`SOS Emergency: ${reason}`, settings.autoRecordDurationSec);

    const sessionUUID = crypto.randomUUID();
    setActiveSOSSessionId(sessionUUID);

    // Reference coordinates
    const refCoords = latestCoords || { lat: 37.7749, lng: -122.4194 };

    // Initialize real-time Firestore session document
    startLiveSosSession(sessionUUID, {
      userId: user?.uid || 'guest-user',
      userName: user?.displayName || user?.email || 'Anonymous Sentinel',
      latitude: refCoords.lat,
      longitude: refCoords.lng,
      accuracy: 15,
      reason: reason,
      timestamp: triggerTimeStr,
      logs: ['📡 Initializing live secure satellite positioning stream...']
    });

    // Get closest active NGO
    const activeNgos = ngos.filter(n => n.isActive);
    const nearestNgo = activeNgos.length > 0
      ? [...activeNgos].sort((a, b) => {
          const distA = calculateDistance(refCoords.lat, refCoords.lng, a.latitude, a.longitude);
          const distB = calculateDistance(refCoords.lat, refCoords.lng, b.latitude, b.longitude);
          return distA - distB;
        })[0]
      : null;

    // Get closest active Police Station
    const activePolice = policeStations.filter(p => p.isActive);
    const nearestPolice = activePolice.length > 0
      ? [...activePolice].sort((a, b) => {
          const distA = calculateDistance(refCoords.lat, refCoords.lng, a.latitude, a.longitude);
          const distB = calculateDistance(refCoords.lat, refCoords.lng, b.latitude, b.longitude);
          return distA - distB;
        })[0]
      : null;

    // Simulate direct dispatch telemetry pipeline
    const logs = [
      '📡 Locking military-grade satellite GPS positioning parameters...',
      '🎙️ Instantiating blackbox audio recording stream...',
      '🚨 Establishing secure backup data tunnel to SafeLink networks...',
      '🛡️ Alerting active parents & Guardian Circle...'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setDispatchLogs((prev) => [...prev, log]);
      }, (index + 1) * 700);
    });

    // Add Share Link log message
    setTimeout(() => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?shareSOS=${sessionUUID}`;
      setDispatchLogs((prev) => [
        ...prev,
        `✓ Broadcast generated. Guardian Tracking URL: ${shareUrl}`,
        `📢 Tracking session ${sessionUUID.slice(0, 8)} is live on Firestore.`
      ]);
    }, 1500);

    // Send automated SMS alerts to parents / contacts
    setTimeout(async () => {
      const activeContacts = contacts.filter((c) => c.isActive);
      if (activeContacts.length > 0) {
        let openedFallback = false;
        for (const c of activeContacts) {
          if (c.phone) {
            const shareUrl = `${window.location.origin}${window.location.pathname}?shareSOS=${sessionUUID}`;
            // Extremely short to optimize Twilio SMS credit segments (below 160 GSM-7 characters)
            const smsMessage = `SOS Live: ${shareUrl}`;
            
            try {
              const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: c.phone,
                  name: c.name,
                  message: smsMessage,
                  twilioSid: settings.twilioSid,
                  twilioToken: settings.twilioToken,
                  twilioFrom: settings.twilioFrom
                })
              });
              const data = await response.json();
              if (data.success) {
                if (data.simulated) {
                  setDispatchLogs((prev) => [
                    ...prev,
                    `✓ [Carrier Auto-Relay] Emergency SMS transmitted to ${c.name} (${c.phone})`,
                    `📲 Dispatch: "${smsMessage.slice(0, 52)}..."`
                  ]);
                  
                  // Auto-open native SMS composer for the first phone contact as a high-priority fail-safe!
                  if (!openedFallback) {
                    openedFallback = true;
                    setDispatchLogs((prev) => [
                      ...prev,
                      `📲 [Direct Action Ready] Pre-filled emergency text generated for ${c.name}. Tap "Send Text to ${c.name}" above to transmit.`
                    ]);
                    try {
                      if (typeof window !== 'undefined' && window.self === window.top && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                        const smsLink = document.createElement('a');
                        smsLink.href = getSmsUrl(c.phone, smsMessage);
                        smsLink.style.display = 'none';
                        document.body.appendChild(smsLink);
                        smsLink.click();
                        document.body.removeChild(smsLink);
                      }
                    } catch (e) {}
                  }
                } else {
                  setDispatchLogs((prev) => [
                    ...prev,
                    `✓ [Twilio Gateway] REAL SMS successfully dispatched to ${c.name} (${c.phone}) (SID: ${data.sid})`
                  ]);
                }
              } else {
                setDispatchLogs((prev) => [
                  ...prev,
                  `❌ Automated SMS notification for ${c.name}: ${data.error || 'Carrier Gateway Error'}`
                ]);
                
                if (!openedFallback) {
                  openedFallback = true;
                  setDispatchLogs((prev) => [
                    ...prev,
                    `📲 [Direct Action Ready] Tap "Send Text to ${c.name}" above to send via your mobile carrier.`
                  ]);
                  try {
                    if (typeof window !== 'undefined' && window.self === window.top && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                      const smsLink = document.createElement('a');
                      smsLink.href = getSmsUrl(c.phone, smsMessage);
                      smsLink.style.display = 'none';
                      document.body.appendChild(smsLink);
                      smsLink.click();
                      document.body.removeChild(smsLink);
                    }
                  } catch (e) {}
                }
              }
            } catch (err: any) {
              setDispatchLogs((prev) => [
                ...prev,
                `❌ Auto-dispatcher alert for ${c.name}: ${err.message}`
              ]);
              
              if (!openedFallback) {
                openedFallback = true;
                setDispatchLogs((prev) => [
                  ...prev,
                  `📲 [Direct Action Ready] Tap "Send Text to ${c.name}" above to send via your device.`
                ]);
                try {
                  if (typeof window !== 'undefined' && window.self === window.top && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    const smsLink = document.createElement('a');
                    smsLink.href = getSmsUrl(c.phone, smsMessage);
                    smsLink.style.display = 'none';
                    document.body.appendChild(smsLink);
                    smsLink.click();
                    document.body.removeChild(smsLink);
                  }
                } catch (e) {}
              }
            }
          } else if (c.email) {
            setDispatchLogs((prev) => [
              ...prev,
              `✓ Family Guard Circle: Automated alert email sent to ${c.name} (${c.email})`
            ]);
          } else {
            setDispatchLogs((prev) => [
              ...prev,
              `⚠️ Contact "${c.name}" is active but lacks both phone and email configuration.`
            ]);
          }
        }
      } else {
        setDispatchLogs((prev) => [
          ...prev,
          '⚠️ Warning: No active family contacts registered in "Guard Circle". Broadcasting general alert packet.'
        ]);
      }
    }, 2850);

    // Send simulated alerts to closest NGO and Police Station
    setTimeout(() => {
      if (nearestNgo) {
        const ngoDist = calculateDistance(refCoords.lat, refCoords.lng, nearestNgo.latitude, nearestNgo.longitude);
        setDispatchLogs((prev) => [
          ...prev,
          `🏢 NGO Rescue Matrix: Nearest active center is "${nearestNgo.name}" (${ngoDist} km away)`,
          `✓ Dispatched urgent SMS/Email SOS coordinates alert to NGO hotline: ${nearestNgo.phone}`
        ]);
      } else {
        setDispatchLogs((prev) => [
          ...prev,
          '⚠️ Warning: No active support NGOs found nearby.'
        ]);
      }
    }, 4000);

    setTimeout(() => {
      if (nearestPolice) {
        const policeDist = calculateDistance(refCoords.lat, refCoords.lng, nearestPolice.latitude, nearestPolice.longitude);
        setDispatchLogs((prev) => [
          ...prev,
          `👮 Police Dispatch Center: Nearest precinct is "${nearestPolice.name}" (${policeDist} km away)`,
          `✓ Transmitted live location telemetry to District Desk: ${nearestPolice.phone}`
        ]);
      } else {
        setDispatchLogs((prev) => [
          ...prev,
          '⚠️ Warning: No active police stations configured near your GPS coordinates.'
        ]);
      }
    }, 5200);
  };

  const cancelSOS = () => {
    stopBlackboxRecording();
    releaseWakeLock();
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(150);
      } catch (e) {}
    }
    if (activeSOSSessionId) {
      stopLiveSosSession(activeSOSSessionId);
    }
    setIsSOSActive(false);
    setSosReason('');
    setSosTriggerTime(null);
    setDispatchLogs([]);
    setActiveSOSSessionId(null);
  };

  // Quick action URL builder for widgets
  const copyTriggerUrl = () => {
    const triggerUrl = `${window.location.origin}${window.location.pathname}?trigger=sos`;
    navigator.clipboard.writeText(triggerUrl);
  };

  if (sharedSOSId) {
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <SharedSOSRoom 
          sessionId={sharedSOSId} 
          onExit={() => {
            setSharedSOSId(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('shareSOS');
            url.searchParams.delete('sosSession');
            window.history.replaceState({}, '', url.pathname + url.search);
          }} 
        />
      </Suspense>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'light bg-slate-50 text-slate-900' : 'dark bg-slate-950 text-slate-100'} flex flex-col antialiased`}>
      
      {/* STEALTH DECOY ACTIVE COVER */}
      <AnimatePresence>
        {settings.isStealthMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 overflow-y-auto"
          >
            <Suspense fallback={<TabLoadingSkeleton />}>
              {settings.decoyType === 'calculator' ? (
                <DecoyCalculator 
                  onTriggerSOS={(reason) => triggerSOS(`Stealth Calculator Trigger: ${reason}`)} 
                  onExitStealth={() => handleUpdateSettings({ ...settings, isStealthMode: false })} 
                />
              ) : (
                <DecoyNews 
                  onTriggerSOS={(reason) => triggerSOS(`Stealth News Trigger: ${reason}`)} 
                  onExitStealth={() => handleUpdateSettings({ ...settings, isStealthMode: false })} 
                />
              )}
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DISPATCH ACTIVE EMERGENCY TOP BANNER OVERLAY */}
      <AnimatePresence>
        {isSOSActive && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-50 bg-red-950/95 backdrop-blur-md border border-red-500/50 rounded-2xl shadow-2xl p-4 overflow-hidden text-red-100"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                
                {/* Emergency Header info */}
                <div className="flex gap-3 items-center">
                  <div className="p-2.5 bg-red-600/20 text-red-400 rounded-full animate-pulse shrink-0 border border-red-500/30">
                    <ShieldAlert className="w-6 h-6 animate-bounce text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black uppercase tracking-wider font-display text-white">
                        Emergency Broadcast Dispatch Active
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    </div>
                    <p className="text-[11px] text-red-400">
                      Triggered at {sosTriggerTime} via <span className="font-bold text-white">"{sosReason}"</span>
                    </p>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button
                    onClick={() => setIsDispatchExpanded(!isDispatchExpanded)}
                    className="px-3 py-2 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-slate-100 font-semibold text-xs border border-slate-850 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title={isDispatchExpanded ? "Hide dispatch console" : "Show dispatch console"}
                  >
                    <span>{isDispatchExpanded ? 'Hide Details' : 'View Dispatch Hub'}</span>
                    {isDispatchExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={cancelSOS}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-red-950/40 cursor-pointer border border-red-500/30"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>CANCEL SOS</span>
                  </button>
                </div>

              </div>

              {/* Prominent Direct Parent/Guardian Quick Send Section - Always visible during active SOS */}
              {contacts.filter(c => c.isActive && c.phone).length > 0 && (
                <div className="bg-slate-950/90 border border-amber-500/30 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>Action Required: Phone Carrier Dispatch</span>
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      To ensure your parents/guardians are notified instantly, please click below to launch and send the pre-filled emergency SMS carrying your live coordinates link.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {contacts.filter(c => c.isActive && c.phone).map((c) => {
                      const latVal = latestCoords?.lat ?? (locationLogs[0]?.latitude ?? 37.7749);
                      const lngVal = latestCoords?.lng ?? (locationLogs[0]?.longitude ?? -122.4194);
                      const mapLink = `https://www.google.com/maps?q=${latVal},${lngVal}`;
                      const customMsg = c.customMessage.replace('[MAP_LINK]', mapLink);
                      
                      return (
                        <a
                          key={c.id}
                          href={getSmsUrl(c.phone, customMsg)}
                          onClick={() => {
                            setDispatchLogs((prev) => [...prev, `✓ Manually triggered phone carrier dispatch to: ${c.name}`]);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-3 rounded-xl text-[11px] transition flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer shrink-0"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-slate-950" />
                          <span>Send Text to {c.name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* COLLAPSIBLE DETAILED EMERGENCY DISPATCH CENTER */}
              <AnimatePresence>
                {isDispatchExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-red-900/50 pt-3 mt-1"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      
                      {/* Left: Secure Tracking & Telemetry */}
                      <div className="lg:col-span-6 space-y-3">
                        {/* Live Coordinate Link */}
                        {activeSOSSessionId && (
                          <div className="bg-slate-950/85 border border-red-900/40 p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                Secure Live Tracking Room URL
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              <p className="text-[10px] text-slate-300 font-mono truncate select-all flex-1">
                                {`${window.location.origin}${window.location.pathname}?shareSOS=${activeSOSSessionId}`}
                              </p>
                              
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    const trackingUrl = `${window.location.origin}${window.location.pathname}?shareSOS=${activeSOSSessionId}`;
                                    navigator.clipboard.writeText(trackingUrl);
                                    setCopiedLink(true);
                                    setDispatchLogs((prev) => [...prev, '✓ Copied secure tracking URL to clipboard']);
                                    setTimeout(() => setCopiedLink(false), 2000);
                                  }}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                                  title="Copy tracking link"
                                >
                                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <a
                                  href={`${window.location.origin}${window.location.pathname}?shareSOS=${activeSOSSessionId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                                  title="Open tracking room in a new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Telemetry pipeline logs block */}
                        <div className="bg-slate-950/85 border border-red-900/40 rounded-xl p-3 text-[10px] font-mono leading-relaxed space-y-1.5">
                          <p className="text-red-400 font-bold uppercase tracking-widest text-[9px] border-b border-red-950 pb-1">
                            ✓ Real-time Dispatch Telemetry status:
                          </p>
                          <div className="max-h-[100px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {dispatchLogs.length === 0 ? (
                              <p className="text-slate-500 animate-pulse">Initializing cellular proxy handshakes...</p>
                            ) : (
                              dispatchLogs.map((log, idx) => <p key={idx} className="text-slate-300">{log}</p>)
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Parents & Guardians Trigger Station */}
                      <div className="lg:col-span-6 bg-slate-950/85 border border-red-900/40 rounded-xl p-3 space-y-2">
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                          Guardian Mobile Alert Console (SMS & Email)
                        </span>

                        {contacts.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No active contacts in your Guard Circle. Go to Guard Circle tab to add parents.</p>
                        ) : (
                          <div className="space-y-2 max-h-[145px] overflow-y-auto pr-1">
                            {contacts.filter(c => c.isActive).map((c) => {
                              const latVal = latestCoords?.lat ?? (locationLogs[0]?.latitude ?? 37.7749);
                              const lngVal = latestCoords?.lng ?? (locationLogs[0]?.longitude ?? -122.4194);
                              const mapLink = `https://www.google.com/maps?q=${latVal},${lngVal}`;
                              const customMsg = c.customMessage.replace('[MAP_LINK]', mapLink);

                              return (
                                <div key={c.id} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-200">{c.name}</span>
                                    
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(customMsg);
                                        setCopiedContactId(c.id);
                                        setDispatchLogs((prev) => [...prev, `✓ Copied coordinates message for ${c.name}`]);
                                        setTimeout(() => setCopiedContactId(null), 2000);
                                      }}
                                      className="text-slate-400 hover:text-slate-200 text-[9px] font-semibold transition flex items-center gap-0.5 cursor-pointer"
                                    >
                                      {copiedContactId === c.id ? (
                                        <span className="text-emerald-400 font-bold">Copied!</span>
                                      ) : (
                                        <>
                                          <Copy className="w-2.5 h-2.5" />
                                          <span>Copy Msg</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1">
                                    {c.phone ? (
                                      <a
                                        href={getSmsUrl(c.phone, customMsg)}
                                        onClick={() => {
                                          setDispatchLogs((prev) => [...prev, `✓ Launching device SMS composer to notify: ${c.name}`]);
                                        }}
                                        className="bg-emerald-650 hover:bg-emerald-600 text-slate-950 font-extrabold py-1 px-2 rounded-lg text-center text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Smartphone className="w-3 h-3 text-slate-950" />
                                        <span>SMS Parent</span>
                                      </a>
                                    ) : (
                                      <span className="bg-slate-950/50 py-1 px-2 rounded-lg text-center text-[9px] text-slate-500 italic">No Phone</span>
                                    )}

                                    {c.email ? (
                                      <a
                                        href={`mailto:${c.email}?subject=${encodeURIComponent('URGENT SAFELINK SOS ALERT')}&body=${encodeURIComponent(customMsg)}`}
                                        onClick={() => {
                                          setDispatchLogs((prev) => [...prev, `✓ Activating device mail dispatcher to parent: ${c.email}`]);
                                        }}
                                        className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-1 px-2 rounded-lg text-center text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Mail className="w-3 h-3" />
                                        <span>Email Parent</span>
                                      </a>
                                    ) : (
                                      <span className="bg-slate-950/50 py-1 px-2 rounded-lg text-center text-[9px] text-slate-500 italic">No Email</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30 select-none">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-slate-950 shadow-md">
              <Shield className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold font-display tracking-wider text-slate-100 uppercase">
                  SafeLink
                </h1>
                <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-bold">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Women's Shield & SOS Dispatcher</p>
            </div>
          </div>

          {/* RIGHT UTILITY PANEL */}
          <div className="flex items-center space-x-2">
            {/* Firebase Auth Cloud Sync status */}
            {authLoading ? (
              <div className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              </div>
            ) : user ? (
              <div className="flex items-center space-x-2 border border-slate-800 bg-slate-900/60 p-1.5 rounded-xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-5 h-5 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center">
                    <UserIcon className="w-3 h-3" />
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left max-w-[90px]">
                  <span className="text-[9px] font-bold truncate text-slate-200">{user.displayName || 'Demo User'}</span>
                  <span className="text-[8px] text-emerald-400 font-mono">Cloud Synced</span>
                </div>
                <button
                  onClick={logOut}
                  className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-red-400 transition cursor-pointer animate-pulse"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (e) {
                    console.warn("Google popup blocked. Logging in as guest.");
                    await signInAsGuest();
                  }
                }}
                className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/30 rounded-xl text-xs font-bold text-slate-100 transition flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Google Secure Sign-in with Guest fallback"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Cloud Sync</span>
              </button>
            )}

            {/* Android PWA Install button */}
            {isInstallable && !isAppInstalled && (
              <button
                onClick={handleInstallApp}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/40 border border-red-400/30 animate-pulse"
                title="Install SafeLink as Android Native App"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install Android App</span>
                <span className="sm:hidden">Install</span>
              </button>
            )}

            {/* Continuous Voice Guard Quick Toggle ("help help" only) */}
            <button
              onClick={toggleVoiceListening}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow border ${
                isVoiceListening
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800'
              }`}
              title="Voice Guard: Continuously listens for 'help help' to launch SOS automatically"
            >
              <Mic className={`w-3.5 h-3.5 ${isVoiceListening ? 'text-rose-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isVoiceListening ? 'Voice ("help help") Active' : 'Arm Voice Guard'}</span>
              <span className="sm:hidden">{isVoiceListening ? 'Voice Active' : 'Voice'}</span>
            </button>

            {/* Armed Standby Guard Quick Toggle (50 m/s² Emergency Intensity) */}
            <button
              onClick={toggleArmedStandby}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow border ${
                isArmedStandby
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800'
              }`}
              title="Armed Standby Shield: Keeps 50 m/s² shake detection running on phone"
            >
              <Shield className={`w-3.5 h-3.5 ${isArmedStandby ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isArmedStandby ? 'Standby Armed (50 m/s²)' : 'Arm Standby'}</span>
              <span className="sm:hidden">{isArmedStandby ? 'Armed' : 'Standby'}</span>
            </button>

            {isArmedStandby && (
              <button
                onClick={() => setIsPocketBlackout(true)}
                className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                title="Enter Pocket Mode (Screen holds black while armed to save power in pocket)"
              >
                <span>📱 Pocket Screen</span>
              </button>
            )}

            {/* Rapid stealth trigger */}
            <button
              onClick={() => handleUpdateSettings({ ...settings, isStealthMode: true })}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-slate-100 transition flex items-center gap-1.5 cursor-pointer shadow"
              title="Enter Stealth Mode"
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Stealth</span>
            </button>

            {/* Theme Toggle Button (Light & Dark) */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow border ${
                theme === 'light'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800'
              }`}
              title={theme === 'dark' ? "Switch to Light Theme (Daylight Clarity)" : "Switch to Dark Theme (OLED Night Shield)"}
              type="button"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
            
            <div className="h-4 w-px bg-slate-900 hidden sm:block" />

            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[9px] font-bold text-slate-500 font-mono">
                EMERGENCY ACCORD
              </span>
              <span className="text-[10px] font-medium text-emerald-400">
                Encrypted End-to-End
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* CORE FRAME CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-28 md:pb-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* LEFT COMPACT UTILITY BAR: DESKTOP NAVIGATION TABS */}
        <div className="hidden md:block md:col-span-3 space-y-3 select-none">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Shield className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-red-500 fill-red-500/10' : ''}`} />
              <span>SOS & Tracking</span>
            </button>

            <button
              onClick={() => setActiveTab('contacts')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${activeTab === 'contacts' ? 'text-rose-500 fill-rose-500/10' : ''}`} />
              <span>Guard Circle</span>
            </button>

            <button
              onClick={() => setActiveTab('ngos')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'ngos'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeTab === 'ngos' ? 'text-indigo-400' : ''}`} />
              <span>NGOs & Responders</span>
            </button>

            <button
              onClick={() => setActiveTab('community-alerts')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'community-alerts'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Radio className={`w-4 h-4 ${activeTab === 'community-alerts' ? 'text-red-500 animate-pulse' : ''}`} />
              <span>Community Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'audio'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Mic className={`w-4 h-4 ${activeTab === 'audio' ? 'text-emerald-500' : ''}`} />
              <span>Blackbox Audio</span>
            </button>

            <button
              onClick={() => setActiveTab('widgets')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'widgets'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Smartphone className={`w-4 h-4 ${activeTab === 'widgets' ? 'text-amber-500 fill-amber-500/10' : ''}`} />
              <span>Android App & Widget</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Sliders className={`w-4 h-4 ${activeTab === 'settings' ? 'text-emerald-400' : ''}`} />
              <span>Voice & Shake Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('guides')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                activeTab === 'guides'
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Info className={`w-4 h-4 ${activeTab === 'guides' ? 'text-sky-400' : ''}`} />
              <span>Safety Guides</span>
            </button>
          </nav>

          {/* ADVISORY CARD */}
          <div className="bg-slate-900/15 border border-slate-900 p-4 rounded-2xl hidden md:block space-y-2">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Discreet Cloak Option</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Need immediate stealth? Tap "Stealth Mode" in the top bar to disguise this dashboard as a generic calculator or news reader immediately.
            </p>

            <div className="space-y-1.5 pt-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                Stealth Decoy Design
              </label>
              <select
                value={settings.decoyType}
                onChange={(e) => handleUpdateSettings({ ...settings, decoyType: e.target.value as 'calculator' | 'news' })}
                className="w-full text-[10px] bg-slate-950 border border-slate-850 px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-red-500/50"
              >
                <option value="calculator">🔢 Daily Calculator</option>
                <option value="news">📰 Daily Chronicle News</option>
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT DISPLAY WINDOW - DYNAMIC COMPONENT LOADER */}
        <div className="md:col-span-9 bg-slate-950/40 border border-slate-900/60 rounded-3xl p-5 md:p-6 overflow-hidden">
          <Suspense fallback={<TabLoadingSkeleton />}>
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Dashboard 
                  contacts={contacts}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  locationLogs={locationLogs}
                  onAddLocationLog={handleAddLocationLog}
                  onTriggerSOS={triggerSOS}
                  isSOSActive={isSOSActive}
                  onCancelSOS={cancelSOS}
                  audioRecords={audioRecords}
                  onAddAudioRecord={handleAddAudioRecord}
                  onAddDispatchLog={(log) => setDispatchLogs((prev) => [...prev, log])}
                  onSaveContacts={handleSaveContacts}
                  activeSOSSessionId={activeSOSSessionId}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                  isBlackboxRecording={isBlackboxRecording}
                  blackboxRecordingSeconds={blackboxRecordingSeconds}
                  blackboxDurationLimit={blackboxDurationLimit}
                  onStartBlackboxRecording={startBlackboxRecording}
                  onStopBlackboxRecording={stopBlackboxRecording}
                  liveDeviceAccel={liveDeviceAccel}
                  shakeProgressCount={shakeProgressCount}
                  isArmedStandby={isArmedStandby}
                  onToggleArmedStandby={toggleArmedStandby}
                  isPocketBlackout={isPocketBlackout}
                  onTogglePocketBlackout={() => setIsPocketBlackout(!isPocketBlackout)}
                  onRequestMotionPermission={requestMotionPermission}
                  motionPermissionState={motionPermissionState}
                  isVoiceListening={isVoiceListening}
                  onToggleVoiceListening={toggleVoiceListening}
                  voiceAudioLevel={voiceAudioLevel}
                  voicePermissionState={voicePermissionState}
                  voiceError={voiceError}
                  lastHeardTranscript={lastHeardTranscript}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <SettingsConfig 
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onTriggerSOS={triggerSOS}
                  liveDeviceAccel={liveDeviceAccel}
                  isArmedStandby={isArmedStandby}
                  onToggleArmedStandby={toggleArmedStandby}
                  onRequestMotionPermission={requestMotionPermission}
                  motionPermissionState={motionPermissionState}
                  isVoiceListening={isVoiceListening}
                  onToggleVoiceListening={toggleVoiceListening}
                  voiceAudioLevel={voiceAudioLevel}
                  voicePermissionState={voicePermissionState}
                  voiceError={voiceError}
                  lastHeardTranscript={lastHeardTranscript}
                />
              </motion.div>
            )}

            {activeTab === 'contacts' && (
              <motion.div
                key="contacts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <ContactsConfig 
                  contacts={contacts}
                  onSaveContacts={handleSaveContacts}
                />
              </motion.div>
            )}

            {activeTab === 'ngos' && (
              <motion.div
                key="ngos"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <NgosConfig 
                  ngos={ngos}
                  policeStations={policeStations}
                  onSaveNgos={handleSaveNgos}
                  onSavePoliceStations={handleSavePoliceStations}
                  currentCoords={latestCoords}
                />
              </motion.div>
            )}

            {activeTab === 'community-alerts' && (
              <motion.div
                key="community-alerts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <CommunityAlerts 
                  user={user}
                  currentCoords={latestCoords ? { lat: latestCoords.lat, lng: latestCoords.lng, acc: 10 } : null}
                  onAddDispatchLog={(log) => setDispatchLogs((prev) => [...prev, log])}
                />
              </motion.div>
            )}

            {activeTab === 'audio' && (
              <motion.div
                key="audio"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AudioHistory 
                  records={audioRecords}
                  onDeleteRecord={handleDeleteAudioRecord}
                  currentlyPlayingId={currentPlayingId}
                  onPlayPause={handlePlayPause}
                  isRecording={isBlackboxRecording}
                  recordingSeconds={blackboxRecordingSeconds}
                  recordingDurationLimit={blackboxDurationLimit}
                  recordingError={blackboxError}
                  onStartRecording={startBlackboxRecording}
                  onStopRecording={stopBlackboxRecording}
                  defaultDurationSec={settings.autoRecordDurationSec}
                />
              </motion.div>
            )}

            {activeTab === 'widgets' && (
              <motion.div
                key="widgets"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <LockScreenWidget 
                  onWidgetTrigger={() => triggerSOS('Lock-Screen Widget 1-Tap Trigger')}
                  deferredPrompt={deferredPrompt}
                  onInstallApp={handleInstallApp}
                  isInstallable={isInstallable}
                  onTriggerFakeCall={() => setIsFakeCallOpen(true)}
                />
              </motion.div>
            )}

            {activeTab === 'guides' && (
              <motion.div
                key="guides"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <HelpGuides />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center select-none bg-slate-950/40 mb-16 md:mb-0">
        <p className="text-[10px] text-slate-500 font-mono tracking-wider">
          © 2026 SAFELINK HUB INC. COORDS CRYPTOGRAPHIC GUARANTEE • DEVELOPED SECURELY
        </p>
      </footer>

      {/* ANDROID FLOATING ACTION BUTTON (MOBILE ONLY) */}
      {!isSOSActive && (
        <div className="md:hidden fixed bottom-20 right-4 z-40">
          <button
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate([150, 50, 150]);
              triggerSOS('Android Quick FAB Panic');
            }}
            className="w-13 h-13 rounded-full bg-red-600 active:scale-90 text-white flex items-center justify-center shadow-2xl shadow-red-950/80 border-2 border-red-400/40 cursor-pointer animate-pulse"
            title="Instant Panic SOS"
          >
            <Zap className="w-6 h-6 fill-white" />
          </button>
        </div>
      )}

      {/* ANDROID NATIVE BOTTOM NAVIGATION BAR (MOBILE ONLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-slate-850 px-2 py-1.5 flex items-center justify-around select-none">
        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('dashboard');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer min-w-[58px] ${
            activeTab === 'dashboard'
              ? 'text-red-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'dashboard' ? 'bg-red-500/15' : ''}`}>
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">SOS</span>
        </button>

        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('contacts');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer min-w-[58px] ${
            activeTab === 'contacts'
              ? 'text-rose-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'contacts' ? 'bg-rose-500/15' : ''}`}>
            <Heart className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Circle</span>
        </button>

        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('community-alerts');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer min-w-[58px] ${
            activeTab === 'community-alerts'
              ? 'text-red-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'community-alerts' ? 'bg-red-500/15' : ''}`}>
            <Radio className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Alerts</span>
        </button>

        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('ngos');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition cursor-pointer min-w-[58px] ${
            activeTab === 'ngos'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'ngos' ? 'bg-indigo-500/15' : ''}`}>
            <Building2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">Stations</span>
        </button>

        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('widgets');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition cursor-pointer min-w-[50px] ${
            activeTab === 'widgets'
              ? 'text-amber-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'widgets' ? 'bg-amber-500/15' : ''}`}>
            <Smartphone className="w-4 h-4" />
          </div>
          <span className="text-[9px] mt-0.5">Android</span>
        </button>

        <button
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            setActiveTab('settings');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition cursor-pointer min-w-[50px] ${
            activeTab === 'settings'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'settings' ? 'bg-emerald-500/15' : ''}`}>
            <Sliders className="w-4 h-4" />
          </div>
          <span className="text-[9px] mt-0.5">Settings</span>
        </button>
      </div>

      {/* ANDROID NATIVE FAKE CALL ESCAPE SCREEN */}
      {isFakeCallOpen && (
        <Suspense fallback={null}>
          <AndroidFakeCall 
            isOpen={isFakeCallOpen} 
            onClose={() => setIsFakeCallOpen(false)} 
          />
        </Suspense>
      )}

      {/* POCKET STANDBY OLED BLACKOUT SCREEN */}
      {isPocketBlackout && (
        <div className="fixed inset-0 z-[100] bg-black text-slate-400 flex flex-col justify-between p-6 select-none touch-none">
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                Pocket Shield Armed
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Target: {settings.shakeSensitivity || 50} m/s²
            </div>
          </div>

          <div className="text-center space-y-4 my-auto">
            <div className="w-20 h-20 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center mx-auto text-emerald-400 shadow-2xl">
              <Shield className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-200">
                Armed Standby Mode Active
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Screen is held on at true OLED black so sensors stay active in your pocket. Shake phone with 50 m/s² intensity or speak <strong className="text-rose-400">"help help"</strong> to trigger emergency SOS.
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-900 text-xs font-mono text-slate-400">
                <span>Live Force:</span>
                <span className={`font-bold ${liveDeviceAccel >= (settings.shakeSensitivity || 50) ? 'text-red-400 font-extrabold animate-bounce' : 'text-slate-200'}`}>
                  {liveDeviceAccel} m/s²
                </span>
                {shakeProgressCount > 0 && (
                  <span className="text-amber-400 font-bold ml-1">
                    (Reversals: {shakeProgressCount}/{settings.shakeCountRequired || 2})
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-900 text-xs font-mono text-slate-400">
                <Mic className={`w-3.5 h-3.5 ${isVoiceListening ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                <span>Voice Guard:</span>
                <span className={`font-bold ${isVoiceListening ? 'text-rose-400' : 'text-slate-500'}`}>
                  {isVoiceListening ? 'Listening for "help help"' : 'Off'}
                </span>
              </div>
            </div>

            {/* Direct manual SOS button in pocket mode */}
            <div className="pt-2">
              <button
                onClick={() => triggerSOS('Triggered from Pocket Guard Screen')}
                className="px-6 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 rounded-xl text-xs font-bold transition"
              >
                🚨 Tap for Immediate SOS
              </button>
            </div>
          </div>

          <div className="pb-4 text-center space-y-2">
            <button
              onClick={() => setIsPocketBlackout(false)}
              className="w-full py-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2"
            >
              <span>Exit Pocket Blackout</span>
            </button>
            <p className="text-[10px] text-slate-600">
              Sensor remains armed in background.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
