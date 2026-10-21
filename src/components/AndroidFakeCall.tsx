import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Grid, User, ShieldAlert, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AndroidFakeCallProps {
  isOpen: boolean;
  onClose: () => void;
  callerName?: string;
  callerNumber?: string;
}

export default function AndroidFakeCall({
  isOpen,
  onClose,
  callerName = 'Mom (Home)',
  callerNumber = '+1 (555) 019-2834'
}: AndroidFakeCallProps) {
  const [callState, setCallState] = useState<'incoming' | 'connected' | 'ended'>('incoming');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<any>(null);

  // Synthesize realistic phone ringtone using Web Audio API (Offline safe)
  const startRingtone = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const playRingBurst = () => {
        if (!ctx || ctx.state === 'closed') return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard North American / European dual-tone ring cadence (440Hz + 480Hz)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + 1.8);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 2.0);
        osc2.stop(ctx.currentTime + 2.0);
      };

      playRingBurst();
      ringtoneIntervalRef.current = setInterval(playRingBurst, 4000);

      // Trigger Android vibration cadence
      if ('vibrate' in navigator) {
        navigator.vibrate([1000, 1000, 1000, 1000, 1000]);
      }
    } catch (e) {
      console.warn('Web Audio ringtone failed to start:', e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  };

  // Play synthesized simulated voice loop on answer
  const playSimulatedVoice = () => {
    try {
      if ('speechSynthesis' in window) {
        const utterances = [
          "Hey, where are you right now? I'm waiting for you outside in the car.",
          "Are you almost ready? I'm right around the corner.",
          "Okay, keep your phone with you. I'm staying on the line until you get here."
        ];
        const text = utterances[Math.floor(Math.random() * utterances.length)];
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      setCallState('incoming');
      setCallDuration(0);
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  // Call duration counter
  useEffect(() => {
    let timer: any = null;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const handleAnswer = () => {
    stopRingtone();
    setCallState('connected');
    playSimulatedVoice();
    if ('vibrate' in navigator) {
      navigator.vibrate([100]);
    }
  };

  const handleDecline = () => {
    stopRingtone();
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-6 select-none font-sans"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 24px), 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)'
        }}
      >
        {/* Android Status bar simulation */}
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold">5G</span>
            <span>LTE</span>
          </div>
          <div className="flex items-center gap-2">
            <span>HD Voice</span>
            <span>100%</span>
          </div>
        </div>

        {/* TOP CALLER INFO (Android Google Dialer Style) */}
        <div className="flex flex-col items-center text-center mt-8 space-y-3">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-2xl relative">
            <User className="w-12 h-12 text-slate-300" />
            {callState === 'incoming' && (
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-display">
              {callerName}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {callerNumber}
            </p>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
              {callState === 'incoming' && 'Incoming Call...'}
              {callState === 'connected' && formatDuration(callDuration)}
              {callState === 'ended' && 'Call Ended'}
            </p>
          </div>
        </div>

        {/* INCOMING STATE: SWIPE / TAP TO ANSWER OR DECLINE */}
        {callState === 'incoming' && (
          <div className="space-y-8 mb-6">
            <div className="flex justify-around items-center px-6">
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleDecline}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-red-950 transition cursor-pointer"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Decline</span>
              </div>

              {/* Answer Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleAnswer}
                  className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-emerald-950 transition cursor-pointer animate-pulse"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Answer</span>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest">
              SafeLink Android Discreet Escape Utility
            </p>
          </div>
        )}

        {/* CONNECTED STATE: DIALER CONTROLS */}
        {callState === 'connected' && (
          <div className="space-y-8 mb-6">
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                  isMuted ? 'bg-slate-800 border-red-500 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span className="text-[10px] font-semibold mt-1">Mute</span>
              </button>

              <button
                onClick={() => setIsSpeaker(!isSpeaker)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                  isSpeaker ? 'bg-slate-800 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                <span className="text-[10px] font-semibold mt-1">Speaker</span>
              </button>

              <button
                onClick={() => playSimulatedVoice()}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-850 transition"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-[10px] font-semibold mt-1">Replay Voice</span>
              </button>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleDecline}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-red-950 transition cursor-pointer"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {/* ENDED STATE */}
        {callState === 'ended' && (
          <div className="text-center text-xs text-slate-400 py-6">
            Returning to SafeLink...
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
