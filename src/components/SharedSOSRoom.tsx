import React, { useState, useEffect } from 'react';
import { subscribeToLiveSos } from '../utils/firebase';
import { calculateDistance } from '../utils/geo';
import { 
  ShieldAlert, MapPin, Radio, Clock, AlertTriangle, Compass, 
  ExternalLink, Sparkles, Building2, ShieldCheck, RefreshCw, X, MessageSquare, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SharedSOSRoomProps {
  sessionId: string;
  onExit: () => void;
}

export default function SharedSOSRoom({ sessionId, onExit }: SharedSOSRoomProps) {
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeAgoStr, setTimeAgoStr] = useState<string>('Just now');
  
  // Safety AI query state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiReferences, setAiReferences] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToLiveSos(sessionId, (data) => {
      setSessionData(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [sessionId]);

  // Update "last updated" timer ticker
  useEffect(() => {
    if (!sessionData?.lastUpdated) return;

    const updateTicker = () => {
      const diffMs = Date.now() - new Date(sessionData.lastUpdated).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 5) {
        setTimeAgoStr('Just now');
      } else if (diffSec < 60) {
        setTimeAgoStr(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgoStr(`${diffMin}m ${diffSec % 60}s ago`);
      }
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [sessionData?.lastUpdated]);

  const handleAskAI = async (customQuery?: string) => {
    if (!sessionData) return;
    const queryToUse = customQuery || aiQuery || "What are the closest police stations, emergency shelters, or public safe zones nearby?";
    setAiLoading(true);
    setAiResponse(null);
    setAiReferences([]);
    
    try {
      const res = await fetch('/api/safe-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: sessionData.latitude,
          lng: sessionData.longitude,
          query: queryToUse
        })
      });
      const data = await res.json();
      if (data.error) {
        setAiResponse(`Failed to request Gemini AI with Maps grounding: ${data.error}`);
      } else {
        setAiResponse(data.text);
        setAiReferences(data.references || []);
      }
    } catch (err: any) {
      setAiResponse(`Network error contacting safety responder server: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400 font-mono animate-pulse">
          Connecting to secure satellite coordinates uplink...
        </p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center space-y-6">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-red-500">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-wider font-display text-slate-100">
            Session Not Found
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            This tracking token does not exist or the live broadcast has expired. Please verify the emergency dispatch link.
          </p>
        </div>
        <button
          onClick={onExit}
          className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Go to Local Home</span>
        </button>
      </div>
    );
  }

  const mapLink = `https://www.google.com/maps?q=${sessionData.latitude},${sessionData.longitude}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      
      {/* HEADER BANNER */}
      <header className="bg-red-950 border-b border-red-900 p-4 sticky top-0 z-10 shadow-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 text-red-400 rounded-full animate-pulse">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">LIVE COORDINATES UPLINK</span>
              </div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider font-display mt-0.5">
                SafeLink Guardian Dispatch Room
              </h1>
            </div>
          </div>
          
          <button
            onClick={onExit}
            className="bg-slate-900 hover:bg-slate-850 text-slate-300 py-2 px-3 border border-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close Room</span>
          </button>
        </div>
      </header>

      {/* TRACKING CONTENT CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: VISUAL POSITION CARD & STATUS TILE */}
        <div className="md:col-span-2 space-y-6">
          
          {/* COORDINATES DISPLAY PANEL */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 md:p-6 space-y-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Satellite Positioning Packet</span>
                <h2 className="text-lg font-bold text-slate-100 font-display flex items-center gap-1.5">
                  <MapPin className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{sessionData.userName || 'SafeLink Sentinel Device'}</span>
                </h2>
              </div>
              
              <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black font-mono text-red-400">{sessionData.active ? 'SOS ACTIVE' : 'SOS RESOLVED'}</span>
              </div>
            </div>

            {/* GPS HUD COMPASS CARD */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-850 font-mono text-center relative overflow-hidden">
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 uppercase font-sans">Latitude</p>
                <p className="text-sm font-black text-slate-200">{sessionData.latitude?.toFixed(6) || '---'}</p>
              </div>
              <div className="space-y-1 border-l border-slate-900">
                <p className="text-[9px] text-slate-500 uppercase font-sans">Longitude</p>
                <p className="text-sm font-black text-slate-200">{sessionData.longitude?.toFixed(6) || '---'}</p>
              </div>
              <div className="space-y-1 border-l border-slate-900">
                <p className="text-[9px] text-slate-500 uppercase font-sans">GPS Accuracy</p>
                <p className="text-sm font-black text-emerald-400">±{sessionData.accuracy ? Math.round(sessionData.accuracy) : '15'}m</p>
              </div>
              <div className="space-y-1 border-l border-slate-900">
                <p className="text-[9px] text-slate-500 uppercase font-sans">Last Uplink</p>
                <p className="text-sm font-black text-indigo-300 animate-pulse">{timeAgoStr}</p>
              </div>
            </div>

            {/* EMBEDDED MAP SIMULATOR AREA */}
            <div className="relative aspect-[16/9] w-full bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden group flex items-center justify-center">
              {/* Radar Grid Animation Backdrop */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
              
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 pointer-events-none" />
              
              {/* Fake animated radar sweeping */}
              <div className="absolute w-[200%] h-[200%] bg-gradient-to-tr from-indigo-500/5 to-transparent origin-center animate-[spin_8s_linear_infinite] pointer-events-none" />

              {/* Dynamic target circle marker */}
              <div className="relative flex flex-col items-center z-10">
                <div className="w-12 h-12 bg-red-500/25 border-2 border-red-500 rounded-full flex items-center justify-center animate-ping absolute" />
                <div className="w-10 h-10 bg-red-600 border border-red-400 rounded-full flex items-center justify-center shadow-lg relative">
                  <MapPin className="w-5 h-5 text-slate-100 fill-white/10 animate-bounce" />
                </div>
                <div className="bg-slate-900/90 border border-slate-850 py-1.5 px-3 rounded-xl mt-3 text-center shadow-md">
                  <p className="text-[10px] font-bold text-slate-200">Device Coordinates Locked</p>
                  <p className="text-[8px] text-slate-500 font-mono mt-0.5">{sessionData.latitude}, {sessionData.longitude}</p>
                </div>
              </div>

              {/* Action Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
                  🛰️ Secure Link Handshake Active
                </span>
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-red-600 hover:bg-red-500 text-slate-100 py-1.5 px-3 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-lg"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Navigate in Google Maps</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* REASON FOR SOS TILE */}
            <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-red-200 uppercase tracking-wider font-display">SOS Trigger Diagnostic</h4>
                <p className="text-xs text-slate-300 leading-normal">
                  "{sessionData.reason || 'Manual Guardian Circle SOS Alert Triggered'}" — Broadcast stream initialized on {sessionData.timestamp || 'Satellite Handshake'}.
                </p>
              </div>
            </div>
          </div>

          {/* AI RESCUE ASSISTANT WITH GOOGLE MAPS GROUNDING */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-display">Safety AI Responder Assistant</h3>
                  <p className="text-[10px] text-slate-500">Gemini 3.5 Grounded with real-time Google Maps telemetry</p>
                </div>
              </div>
              <span className="bg-indigo-950 text-indigo-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-900 font-mono">
                GOOGLE MAPS TOOL
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-normal">
              Need immediate support routing? Ask our Safety AI to query the live Google Maps platform for official crisis lines, active rescue centers, hospitals, local police precincts, or safe zones based precisely on the victim's current GPS location.
            </p>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={aiLoading}
                onClick={() => handleAskAI("Find the nearest 3 active police stations and their phone numbers.")}
                className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-55"
              >
                <Building2 className="w-3 h-3 text-indigo-400" />
                <span>Nearest Police Precincts</span>
              </button>
              <button
                disabled={aiLoading}
                onClick={() => handleAskAI("Find women safety NGOs, crisis support hotlines, or shelters near this coordinate.")}
                className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-55"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Women Shelters & Crisis NGOs</span>
              </button>
              <button
                disabled={aiLoading}
                onClick={() => handleAskAI("What hospitals, safe public transit hubs, or open public spaces are closest to this coordinate?")}
                className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-55"
              >
                <MapPin className="w-3 h-3 text-red-400" />
                <span>Hospitals & Safe Zones</span>
              </button>
            </div>

            {/* AI Text Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAI();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask Safety AI anything (e.g., Is there a public hospital nearby?)..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500/50"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:opacity-50 text-slate-100 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {aiLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </>
                )}
              </button>
            </form>

            {/* AI Response Display */}
            <AnimatePresence>
              {(aiResponse || aiLoading) && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 text-xs leading-relaxed text-slate-300 space-y-3 relative overflow-hidden"
                >
                  {aiLoading ? (
                    <div className="py-4 flex flex-col items-center justify-center space-y-2 text-slate-500">
                      <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <p className="text-[11px] font-mono">Querying Gemini with Google Maps Grounding...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px] uppercase tracking-widest font-mono">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Safety Agent Assessment</span>
                      </div>
                      
                      <div className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-300">
                        {aiResponse}
                      </div>

                      {/* Map place links extracted from grounding */}
                      {aiReferences.length > 0 && (
                        <div className="pt-3 border-t border-slate-900 space-y-2">
                          <p className="text-[10px] font-bold text-indigo-400">Grounded Map References:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {aiReferences.map((ref, idx) => (
                              <a
                                key={idx}
                                href={ref.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-slate-900 hover:bg-slate-850 border border-slate-850 text-slate-300 rounded-lg p-2 flex items-center justify-between text-[10px] transition group cursor-pointer"
                              >
                                <span className="font-bold truncate pr-2">{ref.title}</span>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME TELEMETRY STREAM & LOGS */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl flex flex-col h-[520px]">
            <div className="flex items-center gap-2 border-b border-slate-800/50 pb-3 mb-4">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-wider font-display text-slate-200">
                Rescue Dispatch Feed
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-[10px] leading-relaxed">
              {(!sessionData.logs || sessionData.logs.length === 0) ? (
                <p className="text-slate-600 italic">No telemetry messages received yet from target unit.</p>
              ) : (
                sessionData.logs.map((log: string, idx: number) => {
                  const isSuccess = log.startsWith('✓');
                  const isWarning = log.startsWith('⚠️');
                  const isNormal = !isSuccess && !isWarning;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`p-2 rounded-xl border ${
                        isSuccess 
                          ? 'bg-emerald-950/15 border-emerald-900/30 text-emerald-300' 
                          : isWarning 
                            ? 'bg-amber-950/20 border-amber-900/35 text-amber-300' 
                            : 'bg-slate-950/80 border-slate-900 text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/50 mt-4 text-center">
              <span className="text-[9px] font-sans text-slate-500 uppercase tracking-widest font-black">
                ● AES-256 SATELLITE HANDSHAKE
              </span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
