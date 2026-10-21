import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, EmergencyContact, LocationLog, AudioRecord } from '../types';
import { 
  ShieldAlert, ShieldCheck, Heart, Volume2, Mic, Activity, 
  MapPin, Radio, Wifi, WifiOff, RefreshCw, EyeOff, AlertTriangle,
  Play, Square, Compass, Download, Info, Check, Copy, Send, Smartphone, Mail, Plus, ExternalLink,
  ZoomIn, ZoomOut, Map, Sliders, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  contacts: EmergencyContact[];
  settings: AppSettings;
  onUpdateSettings: (updated: AppSettings) => void;
  locationLogs: LocationLog[];
  onAddLocationLog: (log: LocationLog) => void;
  onTriggerSOS: (reason: string) => void;
  isSOSActive: boolean;
  onCancelSOS: () => void;
  audioRecords: AudioRecord[];
  onAddAudioRecord: (record: AudioRecord) => void;
  onAddDispatchLog?: (log: string) => void;
  onSaveContacts?: (updated: EmergencyContact[]) => void;
  activeSOSSessionId?: string | null;
  onNavigateTab?: (tab: string) => void;
  isBlackboxRecording?: boolean;
  blackboxRecordingSeconds?: number;
  blackboxDurationLimit?: number;
  onStartBlackboxRecording?: (reason?: string, duration?: number) => void;
  onStopBlackboxRecording?: () => void;
  liveDeviceAccel?: number;
  shakeProgressCount?: number;
  isArmedStandby?: boolean;
  onToggleArmedStandby?: () => void;
  isPocketBlackout?: boolean;
  onTogglePocketBlackout?: () => void;
  onRequestMotionPermission?: () => Promise<boolean>;
  motionPermissionState?: 'prompt' | 'granted' | 'denied' | 'unsupported';
  isVoiceListening?: boolean;
  onToggleVoiceListening?: () => void;
  voiceAudioLevel?: number;
  voicePermissionState?: 'prompt' | 'granted' | 'denied' | 'unsupported';
  voiceError?: string;
  lastHeardTranscript?: string;
}

const getSmsUrl = (phone: string, body: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  const isIOS = typeof window !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const separator = isIOS ? '&' : '?';
  return `sms:${cleanPhone}${separator}body=${encodeURIComponent(body)}`;
};

export default function Dashboard({
  contacts,
  settings,
  onUpdateSettings,
  locationLogs,
  onAddLocationLog,
  onTriggerSOS,
  isSOSActive,
  onCancelSOS,
  audioRecords,
  onAddAudioRecord,
  onAddDispatchLog,
  onSaveContacts,
  activeSOSSessionId,
  onNavigateTab,
  isBlackboxRecording = false,
  blackboxRecordingSeconds = 0,
  blackboxDurationLimit = 30,
  onStartBlackboxRecording,
  onStopBlackboxRecording,
  liveDeviceAccel = 0,
  shakeProgressCount = 0,
  isArmedStandby = false,
  onToggleArmedStandby,
  isPocketBlackout = false,
  onTogglePocketBlackout,
  onRequestMotionPermission,
  motionPermissionState = 'prompt',
  isVoiceListening = false,
  onToggleVoiceListening,
  voiceAudioLevel = 0,
  voicePermissionState = 'prompt',
  voiceError = '',
  lastHeardTranscript = ''
}: DashboardProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUncomfortableMode, setIsUncomfortableMode] = useState(false);

  // Quick contact addition & dispatcher toast states
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  
  // Geolocation tracking
  const [trackingActive, setTrackingActive] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number, acc: number} | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  
  // Visual Map custom preferences & helper
  const [mapZoom, setMapZoom] = useState(15);
  const [useDarkMap, setUseDarkMap] = useState(settings.theme !== 'light');

  useEffect(() => {
    setUseDarkMap(settings.theme !== 'light');
  }, [settings.theme]);

  // AI Safe Places & Google Maps Grounding Assistant States
  const [aiSafeQuery, setAiSafeQuery] = useState('');
  const [aiSafeLoading, setAiSafeLoading] = useState(false);
  const [aiSafeResponse, setAiSafeResponse] = useState<string | null>(null);
  const [aiSafeReferences, setAiSafeReferences] = useState<Array<{ title: string; uri: string }>>([]);

  const handleFetchSafePlaces = async (presetQuery?: string) => {
    const lat = currentCoords?.lat || (locationLogs[0]?.latitude ?? 37.7749);
    const lng = currentCoords?.lng || (locationLogs[0]?.longitude ?? -122.4194);
    const q = presetQuery || aiSafeQuery || "What are the nearest secure public places, police stations, or support services near me?";
    setAiSafeLoading(true);
    setAiSafeResponse(null);
    setAiSafeReferences([]);

    try {
      const res = await fetch('/api/safe-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, query: q })
      });
      const data = await res.json();
      if (data.text) {
        setAiSafeResponse(data.text);
        setAiSafeReferences(data.references || []);
      } else {
        setAiSafeResponse("Direct emergency navigation links ready below:");
        setAiSafeReferences([
          { title: "Search Nearest Police Stations on Google Maps", uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z` },
          { title: "Search Nearest 24/7 Hospitals on Google Maps", uri: `https://www.google.com/maps/search/hospital+emergency/@${lat},${lng},15z` }
        ]);
      }
    } catch (err: any) {
      setAiSafeResponse(`Direct navigation links ready below:`);
      setAiSafeReferences([
        { title: "Search Nearest Police Stations on Google Maps", uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z` },
        { title: "Search Nearest 24/7 Hospitals on Google Maps", uri: `https://www.google.com/maps/search/hospital+emergency/@${lat},${lng},15z` }
      ]);
    } finally {
      setAiSafeLoading(false);
    }
  };

  const getOsmMapUrl = (lat: number, lng: number, zoom: number) => {
    // scale delta offset depending on zoom level (approximate degrees)
    const offset = 0.08 / Math.pow(2, zoom - 10);
    const min_lng = lng - offset;
    const min_lat = lat - offset;
    const max_lng = lng + offset;
    const max_lat = lat + offset;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${min_lng}%2C${min_lat}%2C${max_lng}%2C${max_lat}&layer=mapnik&marker=${lat}%2C${lng}`;
  };
  
  // SOS countdown
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Network Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Note: Shake gesture (50 m/s²) and Voice Wake-Word ("help help" only)
  // are centralized globally at root (App.tsx) and persist across all screens and standby.
  // calibrated to 50 m/s² with true linear acceleration physics.

  // Audio level alert sound utility
  const playAlertSound = (freq: number, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error('Audio playback was block or unsupported:', e);
    }
  };

  // Continuous Geolocation Tracker
  useEffect(() => {
    let watchId: number | null = null;

    if (trackingActive || isUncomfortableMode || isSOSActive) {
      setGpsLoading(true);
      setGpsError('');

      if ('geolocation' in navigator) {
        // Fetch GPS coordinates immediately to prevent fallback/default location delay
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setCurrentCoords({ lat: latitude, lng: longitude, acc: Math.round(accuracy) });
            setGpsLoading(false);

            // Log coordinate changes
            const newLog: LocationLog = {
              id: crypto.randomUUID(),
              latitude,
              longitude,
              accuracy: Math.round(accuracy),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              status: isSOSActive ? 'sos' : isUncomfortableMode ? 'uncomfortable' : 'normal'
            };
            onAddLocationLog(newLog);
          },
          (err) => {
            console.warn('Initial getCurrentPosition failed, falling back to watchPosition:', err);
            // Don't set error here as watchPosition might still succeed
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        // Start watching for continuous breadcrumb updates
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setCurrentCoords({ lat: latitude, lng: longitude, acc: Math.round(accuracy) });
            setGpsLoading(false);

            // Log coordinate changes
            const newLog: LocationLog = {
              id: crypto.randomUUID(),
              latitude,
              longitude,
              accuracy: Math.round(accuracy),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              status: isSOSActive ? 'sos' : isUncomfortableMode ? 'uncomfortable' : 'normal'
            };
            onAddLocationLog(newLog);
          },
          (err) => {
            console.error('Continuous geolocation failed:', err);
            setGpsError(`GPS Access Refused: ${err.message}. Ensure location is enabled on your device.`);
            setGpsLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setGpsError('Geolocation is not supported by your current browser environment.');
        setGpsLoading(false);
      }
    } else {
      setCurrentCoords(null);
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [trackingActive, isUncomfortableMode, isSOSActive, onAddLocationLog]);

  // Auto sirening when active
  useEffect(() => {
    let sirenInterval: NodeJS.Timeout | null = null;
    if (isSOSActive && settings.useSirensOnSOS) {
      sirenInterval = setInterval(() => {
        playAlertSound(987.77, 0.4); // B5 note
        setTimeout(() => {
          playAlertSound(1318.51, 0.4); // E6 note
        }, 400);
      }, 900);
    }
    return () => {
      if (sirenInterval) clearInterval(sirenInterval);
    };
  }, [isSOSActive, settings.useSirensOnSOS]);

  // SOS button manual triggers
  const handleSOSButtonDown = () => {
    if (isSOSActive) {
      onCancelSOS();
      return;
    }
    
    // Play quick feedback beep
    if (settings.useBeepOnTriggers) {
      playAlertSound(600, 0.15);
    }

    setCountdown(3);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          onTriggerSOS('Manual Big SOS Button Pressed');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setCountdown(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      
      {/* LEFT HAND PANEL - PRINCIPAL ACTIONS & SOS */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* BIG PULSING SOS PANIC PORT */}
        <div className="bg-slate-900/45 border border-slate-850 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[380px]">
          
          {/* Header context state */}
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                  <Wifi className="w-3.5 h-3.5" />
                  ONLINE SECURITY ACTIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">
                  <WifiOff className="w-3.5 h-3.5" />
                  CELLULAR SMS OFFLINE QUEUE
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                SafeLink Node
              </span>
            </div>
          </div>

          {/* MAIN BIG BUTTON CONTROL */}
          <div className="my-8 relative flex flex-col items-center justify-center">
            
            <AnimatePresence mode="wait">
              {countdown !== null ? (
                <motion.div 
                  key="countdown"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex flex-col items-center justify-center z-10"
                >
                  <button
                    onClick={handleCancelCountdown}
                    className="w-40 h-40 rounded-full bg-slate-950 border-4 border-slate-800 text-slate-200 font-bold hover:bg-slate-900 transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="text-4xl font-extrabold text-amber-500 font-display animate-pulse">
                      {countdown}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">
                      Tap to cancel
                    </span>
                  </button>
                  <p className="text-xs text-amber-500 font-semibold mt-4">
                    SOS Broadcast Initiating...
                  </p>
                </motion.div>
              ) : isSOSActive ? (
                <motion.div 
                  key="active-sos"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="flex flex-col items-center justify-center z-10"
                >
                  <button
                    onClick={onCancelSOS}
                    className="w-44 h-44 rounded-full bg-red-600 hover:bg-red-500 text-slate-100 flex flex-col items-center justify-center gap-2 transition cursor-pointer pulse-ripple border-[6px] border-red-950"
                  >
                    <ShieldAlert className="w-12 h-12 text-white animate-bounce" />
                    <span className="text-sm font-extrabold uppercase tracking-widest font-display">
                      DEACTIVATE
                    </span>
                    {(isBlackboxRecording || isRecording) && (
                      <span className="text-[10px] bg-black/40 text-red-300 font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        REC: {blackboxRecordingSeconds || recordingSeconds}s
                      </span>
                    )}
                  </button>
                  <p className="text-xs text-red-400 font-bold mt-4 animate-pulse">
                    EMERGENCY SOS IS BROADCASTING LIVE!
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle-sos"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="flex flex-col items-center justify-center z-10"
                >
                  <button
                    onClick={handleSOSButtonDown}
                    className="w-40 h-40 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-slate-100 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer border-[8px] border-slate-950 shadow-2xl relative"
                  >
                    <ShieldAlert className="w-12 h-12 text-slate-950 fill-white/80" />
                    <span className="text-base font-extrabold uppercase tracking-widest font-display text-slate-950">
                      SOS
                    </span>
                    <span className="text-[9px] text-slate-950 font-medium tracking-wide uppercase opacity-75">
                      Press to Trigger
                    </span>
                  </button>
                  <p className="text-xs text-slate-400 mt-4 leading-normal max-w-[280px]">
                    Single tap will prompt a safe 3-second countdown before broadcasting.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Glowing aesthetic ambient background circles */}
            <div className={`absolute w-60 h-60 rounded-full filter blur-3xl opacity-20 pointer-events-none transition-colors ${
              isSOSActive ? 'bg-red-500 animate-pulse' : 'bg-rose-500'
            }`} />
          </div>

          {/* QUICK TRANSIT & UNCOMFORTABLE MODES */}
          <div className="w-full grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => {
                setIsUncomfortableMode(!isUncomfortableMode);
                if (settings.useBeepOnTriggers) {
                  playAlertSound(440, 0.2);
                }
              }}
              className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                isUncomfortableMode
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-md'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Activity className={`w-4 h-4 ${isUncomfortableMode ? 'animate-pulse text-amber-500' : ''}`} />
              <span>
                {isUncomfortableMode ? 'UNCOMFORTABLE: COORDS STREAMING' : 'I FEEL UNCOMFORTABLE'}
              </span>
            </button>

            <button
              onClick={() => {
                setTrackingActive(!trackingActive);
                if (settings.useBeepOnTriggers) {
                  playAlertSound(554.37, 0.2); // C#5
                }
              }}
              className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                trackingActive
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Compass className={`w-4 h-4 ${trackingActive ? 'animate-spin-slow text-emerald-400' : ''}`} />
              <span>
                {trackingActive ? 'TRANSIT TRACKING ACTIVE' : 'ROUTE ACCURACY TRACKER'}
              </span>
            </button>
          </div>
        </div>





        {/* COORDS LOG & OFFLINE DISPATCH RADER */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
              <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />
              Live Precision Navigation Coordinates
            </h3>

            {currentCoords && (
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-semibold">
                Accuracy: {currentCoords.acc}m
              </span>
            )}
          </div>

          {currentCoords ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-900 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Latitude</span>
                  <span className="text-sm font-mono font-semibold text-slate-200 mt-1">{currentCoords.lat.toFixed(6)}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-900 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Longitude</span>
                  <span className="text-sm font-mono font-semibold text-slate-200 mt-1">{currentCoords.lng.toFixed(6)}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-900 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Map Route Link</span>
                  <a 
                    href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-medium text-emerald-400 hover:underline mt-1 truncate flex items-center gap-1"
                  >
                    <span>google.com/maps/q={currentCoords.lat.toFixed(4)}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* VISUAL LIGHTWEIGHT MAP CARD */}
              <div className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-lg relative">
                {/* Map Control Header */}
                <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-900 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Map className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Visual Radar Position Feed</span>
                  </div>
                  
                  {/* Map Quick Controls */}
                  <div className="flex items-center gap-2">
                    {/* Zoom Buttons */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shrink-0">
                      <button 
                        onClick={() => setMapZoom(prev => Math.max(12, prev - 1))}
                        disabled={mapZoom <= 12}
                        className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Zoom Out"
                        type="button"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-[10px] font-mono text-slate-400 select-none">
                        Z{mapZoom}
                      </span>
                      <button 
                        onClick={() => setMapZoom(prev => Math.min(18, prev + 1))}
                        disabled={mapZoom >= 18}
                        className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Zoom In"
                        type="button"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dark/Light toggle for aesthetic pairing */}
                    <button
                      onClick={() => setUseDarkMap(!useDarkMap)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                        useDarkMap 
                          ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                      type="button"
                    >
                      {useDarkMap ? 'HUD Theme' : 'Street Theme'}
                    </button>
                  </div>
                </div>

                {/* Map iframe */}
                <div className="relative h-[260px] w-full bg-slate-900 overflow-hidden">
                  <iframe
                    title="Live Breadcrumb Map"
                    src={getOsmMapUrl(currentCoords.lat, currentCoords.lng, mapZoom)}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full border-0 transition-all duration-300"
                    style={{
                      filter: useDarkMap 
                        ? 'invert(90%) hue-rotate(180deg) brightness(85%) contrast(105%)' 
                        : 'none'
                    }}
                    allowFullScreen
                  />
                  
                  {/* Subtle premium radar sweep overlay for the HUD style */}
                  {useDarkMap && (
                    <div className="absolute inset-0 pointer-events-none border border-emerald-500/10 bg-gradient-to-t from-emerald-500/5 to-transparent animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ) : gpsLoading ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-900 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs text-slate-400">Locking live GPS coordinates satellite feed...</p>
            </div>
          ) : gpsError ? (
            <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-300 text-xs flex gap-2.5 items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-red-400">Satellite Coordinates Lock Failed</p>
                <p className="text-[10px] text-slate-400 leading-normal">{gpsError}</p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-900">
              <Compass className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-slate-400">GPS Tracker Idle</p>
              <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto mt-1 leading-normal">
                Enable "Uncomfortable Mode" or "Transit Tracking" above to stream live breadcrumbs to emergency guardians.
              </p>
            </div>
          )}

          {/* SIMULATED OFFLINE CELLULAR DISPATCH */}
          {!isOnline && isSOSActive && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-display">
                  Poor Connection: Local Offline Dispatcher
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                Network connection is compromised. Under extreme conditions, click the rapid action below to instantly draft a cellular SMS packet containing your precise GPS parameters ready for immediate carrier dispatch.
              </p>
              
              {contacts.length > 0 ? (
                <div className="flex gap-2">
                  {contacts.filter(c => c.isActive && c.phone).map((c) => (
                    <a
                      key={c.id}
                      href={getSmsUrl(
                        c.phone,
                        activeSOSSessionId
                          ? `🚨 EMERGENCY SOS ALERT: I need urgent help! Track my continuous live location in real time: ${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?shareSOS=${activeSOSSessionId}`
                          : `SOS! I feel unsafe. My live coords: https://www.google.com/maps?q=${currentCoords?.lat || '0'},${currentCoords?.lng || '0'}`
                      )}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-lg hover:bg-amber-400 transition flex items-center gap-1 shadow-md"
                    >
                      <span>Text {c.name}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-slate-500">
                  Please add at least one trusted phone contact inside the "Guard Circle" panel to activate offline SMS links.
                </p>
              )}
            </div>
          )}

          {/* LOCATION LOG HISTORY LIST */}
          {locationLogs.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-850 pt-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Breadcrumb Trail Log ({locationLogs.length})
              </span>
              <div className="max-h-[110px] overflow-y-auto space-y-1 pr-1">
                {locationLogs.map((log) => (
                  <div key={log.id} className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-950 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        log.status === 'sos' ? 'bg-red-500' : log.status === 'uncomfortable' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <span>{log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500">Acc: {log.accuracy}m</span>
                      <span className="text-[9px] text-slate-500">{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI SAFE PLACES & GOOGLE MAPS GROUNDING RADAR */}
          <div className="space-y-3 border-t border-slate-850 pt-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                  Safe Havens & Emergency Radar
                </h4>
              </div>
              <span className="text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Google Maps Grounded
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Find immediate secure public shelters, 24/7 police kiosks, transit hubs, and hospital emergency facilities around your live coordinates.
            </p>

            {/* Quick Action Preset Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleFetchSafePlaces("What are the closest police stations or precincts near me?")}
                disabled={aiSafeLoading}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                👮 Nearest Police Precincts
              </button>
              <button
                type="button"
                onClick={() => handleFetchSafePlaces("What are the nearest 24/7 hospitals or emergency medical centers near me?")}
                disabled={aiSafeLoading}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                🏥 24/7 Medical Emergency
              </button>
              <button
                type="button"
                onClick={() => handleFetchSafePlaces("What are the nearest safe transit stations, metro stops, or women crisis centers near me?")}
                disabled={aiSafeLoading}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                🚇 Safe Public Transit
              </button>
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask e.g. nearest 24hr pharmacy, well-lit street..."
                value={aiSafeQuery}
                onChange={(e) => setAiSafeQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchSafePlaces();
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="button"
                onClick={() => handleFetchSafePlaces()}
                disabled={aiSafeLoading}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {aiSafeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Find</span>
              </button>
            </div>

            {/* AI Results & Map Grounding Links */}
            {aiSafeLoading && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 flex items-center justify-center gap-2 text-xs text-amber-400">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Scanning Google Maps for verified safe locations near your GPS...</span>
              </div>
            )}

            {aiSafeResponse && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2 text-xs text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto">
                <div className="whitespace-pre-wrap font-sans text-[11px] text-slate-200">
                  {aiSafeResponse}
                </div>

                {aiSafeReferences.length > 0 && (
                  <div className="pt-2 border-t border-slate-900 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                      Direct Navigation Links:
                    </span>
                    <div className="flex flex-col gap-1">
                      {aiSafeReferences.map((ref, i) => (
                        <a
                          key={i}
                          href={ref.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-1.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-amber-300 hover:text-amber-200 transition"
                        >
                          <span className="truncate pr-2 font-medium">{ref.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT HAND PANEL - SENSORS & GESTURES TRIGGER SETTINGS */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* VOICE COMMAND KEYWORD TRIGGERS ("help help" ONLY) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
              <Mic className="w-4 h-4 text-rose-400" />
              Voice Command Wake-Word
            </h3>
            <div className="flex items-center gap-1.5">
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('settings')}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] text-rose-400 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  title="Open Voice Calibration & Testing Studio"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Test Audio</span>
                </button>
              )}
              {onToggleVoiceListening && (
                <button
                  onClick={onToggleVoiceListening}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    isVoiceListening
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                      : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {isVoiceListening ? 'GUARD ACTIVE • "HELP HELP"' : 'ACTIVATE VOICE GUARD'}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Exclusively locked to the urgent phrase <strong className="text-rose-400 font-bold">"help help"</strong>. <span className="text-slate-300 font-semibold">No other words will work on this</span>, and single words are ignored to prevent false alarms. Whether the app is opened or secondary in the background/pocket, when it hears the wake word, it <strong className="text-rose-400">automatically launches SOS</strong>.
          </p>

          {isVoiceListening && (
            <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-900">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-rose-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  Continuous Voice Guard Active ({settings.wakeWordLanguage || 'en-US'})
                </span>
                <span className="text-slate-500">Amplitude: {voiceAudioLevel}%</span>
              </div>
              
              {/* Voice feedback amplitude slider bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                <div 
                  className="bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 h-full transition-all duration-75"
                  style={{ width: `${voiceAudioLevel}%` }}
                />
              </div>

              {lastHeardTranscript && (
                <div className="text-[10px] text-slate-400 font-mono truncate pt-1">
                  <span className="text-slate-600">Last heard: </span>
                  <span className="text-slate-300 font-bold">"{lastHeardTranscript}"</span>
                </div>
              )}
            </div>
          )}

          {voiceError && (
            <p className="text-[10px] text-amber-500 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
              {voiceError}
            </p>
          )}

          {/* Locked Emergency Wake Word Box */}
          <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Emergency Wake-Word (Locked Rule)</span>
              <span className="text-rose-400 font-mono font-extrabold text-xs">"help help" ONLY</span>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-mono font-extrabold text-slate-100">help help</span>
              </div>
              <span className="text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                No Other Words Work
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>When app is opened or not is secondary: upon hearing "help help", SOS automatically launches immediately.</span>
            </div>
          </div>
        </div>

        {/* PANIC MOTION & GESTURES (50 m/s² SHAKE, ARMED STANDBY, TRIPLE-TAP) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
              <Activity className="w-4 h-4 text-amber-400" />
              Emergency Shake Gesture ({settings.shakeSensitivity || 50} m/s²)
            </h3>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('settings')}
                className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] text-amber-400 rounded-lg transition flex items-center gap-1 cursor-pointer"
                title="Open physical force calibration tester"
              >
                <Sliders className="w-3 h-3" />
                <span>Calibrate</span>
              </button>
            )}
          </div>
          
          <p className="text-xs text-slate-400 leading-normal">
            SOS triggers when the phone is shaken vigorously with <strong className="text-slate-200">{settings.shakeSensitivity || 50} m/s² intensity</strong> (~5.1 G). Minor movements, carrying, or walking will not accidentally activate the alert.
          </p>

          {/* REAL-TIME ACCELEROMETER FORCE METER */}
          <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${liveDeviceAccel >= (settings.shakeSensitivity || 50) ? 'bg-red-500 animate-ping' : 'bg-amber-400'}`} />
                Live Force Meter
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${liveDeviceAccel >= (settings.shakeSensitivity || 50) ? 'text-red-400 animate-bounce' : 'text-slate-200'}`}>
                  {liveDeviceAccel} m/s²
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (Target: {settings.shakeSensitivity || 50} m/s²)
                </span>
              </div>
            </div>

            {/* Dynamic Meter Bar */}
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
              <div 
                className={`h-full transition-all duration-75 ${
                  liveDeviceAccel >= (settings.shakeSensitivity || 50)
                    ? 'bg-red-500'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, Math.round((liveDeviceAccel / (settings.shakeSensitivity || 50)) * 100))}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-0.5">
              <span>0 m/s² (Calm)</span>
              {shakeProgressCount > 0 ? (
                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Shake Progress: {shakeProgressCount}/{settings.shakeCountRequired || 2} Reversals
                </span>
              ) : (
                <span className="text-slate-600">Reversal Filter: {settings.shakeCountRequired || 2} required</span>
              )}
              <span className="text-emerald-400 font-bold">{settings.shakeSensitivity || 50} m/s² Trigger</span>
            </div>
          </div>

          {/* ARMED STANDBY & POCKET GUARD CONTROLS */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className={`w-4 h-4 ${isArmedStandby ? 'text-emerald-400' : 'text-slate-500'}`} />
                  Armed Standby Shield (Phone in Pocket / Travel)
                </span>
                <p className="text-[10px] text-slate-400">
                  Keeps the 50 m/s² shake sensor running uninterrupted using Screen Wake Lock and audio keepalive.
                </p>
              </div>

              {onToggleArmedStandby && (
                <button
                  onClick={onToggleArmedStandby}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isArmedStandby 
                      ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-950/40' 
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span>{isArmedStandby ? '✓ Armed' : 'Arm Shield'}</span>
                </button>
              )}
            </div>

            {/* Pocket Black Screen Quick Trigger */}
            {isArmedStandby && onTogglePocketBlackout && (
              <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p className="text-[10px] text-slate-400">
                  Putting phone in pocket? Blackout screen holds phone awake without draining battery or accidental touches.
                </p>
                <button
                  onClick={onTogglePocketBlackout}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-mono font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span>📱 Enter Pocket Mode</span>
                </button>
              </div>
            )}

            {/* iOS Motion Permission Request if Needed */}
            {motionPermissionState === 'prompt' && onRequestMotionPermission && (
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                <span className="text-[10px] text-amber-400">iOS requires sensor approval:</span>
                <button
                  onClick={onRequestMotionPermission}
                  className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded-lg transition"
                >
                  Enable Motion Sensor
                </button>
              </div>
            )}
          </div>

          {/* Triple tap safety test */}
          <div 
            onDoubleClick={() => onTriggerSOS('Double Tap Shortcut Gesture Triggered')}
            className="p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 rounded-2xl flex flex-col justify-center items-center text-center cursor-pointer transition select-none group"
          >
            <span className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition mb-1">
              x2
            </span>
            <p className="text-xs font-semibold text-slate-200">Double-Tap Screen Shortcut</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Double click inside this box to immediately bypass countdown and trigger emergency.
            </p>
          </div>

          {/* SENSITIVITY RANGE SLIDER & QUICK PRESETS */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Force Threshold Calibration ({settings.shakeSensitivity || 50} m/s²)
              </label>
              <button
                onClick={() => onUpdateSettings({ ...settings, shakeSensitivity: 50, shakeCountRequired: 2 })}
                className="text-[9px] text-emerald-400 font-mono font-bold hover:underline cursor-pointer"
              >
                Set to 50 m/s² (Target)
              </button>
            </div>
            
            <input
              type="range"
              min="15"
              max="75"
              step="1"
              value={settings.shakeSensitivity || 50}
              onChange={(e) => onUpdateSettings({ ...settings, shakeSensitivity: Number(e.target.value) })}
              className="w-full accent-amber-500 bg-slate-950 h-1.5 rounded-lg outline-none transition cursor-pointer"
            />
            
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>15 m/s² (Light)</span>
              <span className="text-emerald-400 font-bold">50 m/s² (Target Emergency Force)</span>
              <span>75 m/s² (Extreme)</span>
            </div>
          </div>
        </div>

        {/* SIREN & AUDIO BROADCAST SETTINGS */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            Beacon & Recording Settings
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.useSirensOnSOS}
                onChange={(e) => onUpdateSettings({ ...settings, useSirensOnSOS: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-850 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition">
                  Emit Loud Acoustic Siren
                </span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Siren sounds on SOS to deter aggressors and alert bystanders. Turn off for fully silent SOS.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.useBeepOnTriggers}
                onChange={(e) => onUpdateSettings({ ...settings, useBeepOnTriggers: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-850 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition">
                  Sensor Feedback Haptics
                </span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Play quick audio tones to verify when a gesture, shake, or countdown is initiated.
                </p>
              </div>
            </label>

            <div className="space-y-1 pt-1.5">
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Automatic Blackbox Duration</span>
                <span className="text-emerald-400 font-mono">{settings.autoRecordDurationSec}s</span>
              </div>
              <input
                type="number"
                min="5"
                max="180"
                value={settings.autoRecordDurationSec}
                onChange={(e) => onUpdateSettings({ ...settings, autoRecordDurationSec: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-850 focus:border-red-500/55 rounded-xl text-slate-100 outline-none transition"
              />
            </div>

            {/* Quick Blackbox Ambient Record Trigger */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Ambient Audio Evidence
                </span>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('audio')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 transition underline cursor-pointer"
                  >
                    View Logs ({audioRecords.length})
                  </button>
                )}
              </div>

              {isBlackboxRecording ? (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-mono text-red-300 font-bold">
                      Recording: {blackboxRecordingSeconds}s
                    </span>
                  </div>
                  {onStopBlackboxRecording && (
                    <button
                      onClick={onStopBlackboxRecording}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition"
                    >
                      Stop & Save
                    </button>
                  )}
                </div>
              ) : (
                onStartBlackboxRecording && (
                  <button
                    onClick={() => onStartBlackboxRecording('Dashboard Manual Capture', settings.autoRecordDurationSec)}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Record Blackbox Audio Now ({settings.autoRecordDurationSec}s)</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
