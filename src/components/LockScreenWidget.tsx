import React, { useState, useEffect } from 'react';
import { 
  Tablet, Copy, Check, ShieldAlert, Zap, AppWindow, 
  ArrowRight, Sun, Calendar, Smartphone, Download, 
  Layers, Terminal, CheckCircle2, Shield, Radio, Volume2, Sparkles, ExternalLink,
  Phone, Clock, Sliders, Code2, FileCode, Play
} from 'lucide-react';

interface LockScreenWidgetProps {
  onWidgetTrigger: () => void;
  deferredPrompt?: any;
  onInstallApp?: () => void;
  isInstallable?: boolean;
  onTriggerFakeCall?: () => void;
}

export default function LockScreenWidget({ 
  onWidgetTrigger, 
  deferredPrompt, 
  onInstallApp,
  isInstallable,
  onTriggerFakeCall
}: LockScreenWidgetProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCapacitor, setCopiedCapacitor] = useState(false);
  const [copiedBubblewrap, setCopiedBubblewrap] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedActivity, setCopiedActivity] = useState(false);
  const [phoneTime, setPhoneTime] = useState('');
  const [phoneDate, setPhoneDate] = useState('');
  const [widgetLocked, setWidgetLocked] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'install' | 'apk' | 'fakecall' | 'simulator'>('install');
  
  // Fake Call Scheduling in Widget Tab
  const [fakeCallDelay, setFakeCallDelay] = useState<number>(0);
  const [fakeCallTimerActive, setFakeCallTimerActive] = useState(false);
  const [fakeCallSecondsLeft, setFakeCallSecondsLeft] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setPhoneTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      setPhoneDate(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle scheduled fake call countdown
  useEffect(() => {
    let timer: any = null;
    if (fakeCallTimerActive && fakeCallSecondsLeft > 0) {
      timer = setInterval(() => {
        setFakeCallSecondsLeft(prev => {
          if (prev <= 1) {
            setFakeCallTimerActive(false);
            if (onTriggerFakeCall) onTriggerFakeCall();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fakeCallTimerActive, fakeCallSecondsLeft, onTriggerFakeCall]);

  const startFakeCallCountdown = (seconds: number) => {
    if (seconds === 0) {
      if (onTriggerFakeCall) onTriggerFakeCall();
      return;
    }
    setFakeCallSecondsLeft(seconds);
    setFakeCallTimerActive(true);
  };

  const triggerUrl = `${window.location.origin}${window.location.pathname}?trigger=sos`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(triggerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const androidManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.safelink.sos">

    <!-- Emergency Hardware & Network Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme.NoActionBar"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/title_activity_main"
            android:launchMode="singleTask"
            android:screenOrientation="portrait"
            android:showWhenLocked="true"
            android:turnScreenOn="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const mainActivityKotlin = `package com.safelink.sos

import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private var volumeDownPressCount = 0
    private var lastVolumeDownTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Show over lockscreen during active emergency triggers
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }

    // Native Triple-Press Volume Down Hardware Panic Trigger
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastVolumeDownTime < 1200) {
                volumeDownPressCount++
                if (volumeDownPressCount >= 3) {
                    volumeDownPressCount = 0
                    // Trigger SOS in Capacitor Webview
                    bridge.eval("window.dispatchEvent(new CustomEvent('native-hardware-sos'))") {}
                }
            } else {
                volumeDownPressCount = 1
            }
            lastVolumeDownTime = currentTime
        }
        return super.onKeyDown(keyCode, event)
    }
}`;

  const bubblewrapCode = `# Step 1: Install Google Bubblewrap CLI
npm install -g @bubblewrap/cli

# Step 2: Initialize Android Project from SafeLink Web Manifest
bubblewrap init --manifest=${window.location.origin}/manifest.json

# Step 3: Build Production Signed Android APK / AAB
bubblewrap build`;

  const capacitorCode = `# Step 1: Add Capacitor Android to this project
npm install @capacitor/core @capacitor/cli @capacitor/android

# Step 2: Initialize Capacitor config
npx cap init SafeLink "com.safelink.sos" --web-dir dist

# Step 3: Build Web Assets & Add Android Platform
npm run build
npx cap add android

# Step 4: Open in Android Studio to run or export signed APK
npx cap open android`;

  const downloadFile = (filename: string, content: string, mimeType: string = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER SWITCHER TABS */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveSubTab('install')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'install'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install Android App</span>
        </button>

        <button
          onClick={() => setActiveSubTab('fakecall')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'fakecall'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Fake Call Escape</span>
        </button>

        <button
          onClick={() => setActiveSubTab('apk')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'apk'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Android Studio / APK Export</span>
        </button>

        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'simulator'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Tablet className="w-3.5 h-3.5" />
          <span>Lock-Screen Widget</span>
        </button>
      </div>

      {/* TAB 1: 1-TAP ANDROID INSTALLATION & PWA */}
      {activeSubTab === 'install' && (
        <div className="space-y-5">
          {/* Main Hero Card for Android App */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center shadow-lg p-2.5 shrink-0">
                  <img src="/icon-192.svg" alt="SafeLink Logo" className="w-full h-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-100 font-display">SafeLink Android App</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold rounded-full">
                      PWA & APK Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Installs natively on Android with offline storage, standalone window, and lock-screen widget triggers.
                  </p>
                </div>
              </div>

              {onInstallApp && (
                <button
                  onClick={onInstallApp}
                  className="px-5 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs rounded-2xl transition flex items-center gap-2 shadow-xl shadow-red-950/60 cursor-pointer shrink-0 border border-red-400/30"
                >
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>Install to Android</span>
                </button>
              )}
            </div>

            {/* Android Native Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">App Window</p>
                <p className="text-xs font-black text-slate-200 mt-0.5">Fullscreen Standalone</p>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">Haptics</p>
                <p className="text-xs font-black text-emerald-400 mt-0.5">Native Vibration Motor</p>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">Screen State</p>
                <p className="text-xs font-black text-amber-400 mt-0.5">Wake Lock Enabled</p>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">Offline SOS</p>
                <p className="text-xs font-black text-indigo-400 mt-0.5">Service Worker Active</p>
              </div>
            </div>
          </div>

          {/* Simple Step-by-Step for Android Users */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              How to Install & Use SafeLink on Any Android Device
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <p className="text-xs font-bold text-slate-200">Open in Chrome or Edge</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Open this SafeLink app URL on your Android device in Google Chrome, Samsung Internet, or Brave.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <p className="text-xs font-bold text-slate-200">Tap "Add to Home Screen"</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tap the browser menu <strong className="text-slate-200">(⋮)</strong> and select <strong className="text-slate-200">"Install app"</strong> or <strong className="text-slate-200">"Add to Home Screen"</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <p className="text-xs font-bold text-slate-200">Instant Native Experience</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  SafeLink appears directly in your Android App Drawer, works offline, and supports quick app shortcuts!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAKE CALL ESCAPE TOOL */}
      {activeSubTab === 'fakecall' && (
        <div className="space-y-5">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-display">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  Android Fake Incoming Call Generator
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Discreetly trigger an authentic full-screen Android phone call with synthesized voice conversation and ringtone to safely excuse yourself from uncomfortable situations.
                </p>
              </div>
            </div>

            {/* Timer countdown if active */}
            {fakeCallTimerActive && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-sm animate-pulse">
                    {fakeCallSecondsLeft}s
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-300">Fake Call Scheduled</p>
                    <p className="text-[10px] text-slate-400">Phone will ring in {fakeCallSecondsLeft} seconds...</p>
                  </div>
                </div>
                <button
                  onClick={() => setFakeCallTimerActive(false)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Quick Action Triggers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => startFakeCallCountdown(0)}
                className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl transition flex flex-col items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/30"
              >
                <Play className="w-5 h-5 fill-white" />
                <span className="text-xs font-bold">Ring Immediately</span>
              </button>

              <button
                onClick={() => startFakeCallCountdown(10)}
                className="p-4 bg-slate-950 hover:bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Ring in 10s</span>
              </button>

              <button
                onClick={() => startFakeCallCountdown(30)}
                className="p-4 bg-slate-950 hover:bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Ring in 30s</span>
              </button>

              <button
                onClick={() => startFakeCallCountdown(60)}
                className="p-4 bg-slate-950 hover:bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Ring in 1 Min</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-2 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-bold text-slate-300">✨ How it works:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Simulates full-screen Android phone call with vibration and dual-tone ring cadence.</li>
                <li>When you swipe Answer, voice playback will simulate a conversational friend or parent telling you they are waiting outside.</li>
                <li>Keypad, Mute, and Speaker buttons operate realistically to maintain stealth.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STANDALONE ANDROID APK & KOTLIN SOURCE FILES */}
      {activeSubTab === 'apk' && (
        <div className="space-y-5">
          {/* Direct File Exporter */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-display">
              <Code2 className="w-4 h-4 text-emerald-400" />
              Download Ready-to-Build Android Project Files
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Download the fully configured Android source files with background location tracking, hardware volume panic listener, and wake-lock permissions ready to compile in Android Studio.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => downloadFile('AndroidManifest.xml', androidManifestXml, 'application/xml')}
                className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">AndroidManifest.xml</p>
                    <p className="text-[10px] text-slate-500">Permissions & Intents</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
              </button>

              <button
                onClick={() => downloadFile('MainActivity.kt', mainActivityKotlin, 'text/plain')}
                className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">MainActivity.kt</p>
                    <p className="text-[10px] text-slate-500">Hardware Panic Button</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
              </button>

              <button
                onClick={() => downloadFile('capacitor.config.json', JSON.stringify({
                  appId: "com.safelink.sos",
                  appName: "SafeLink SOS",
                  webDir: "dist",
                  server: { androidScheme: "https" }
                }, null, 2), 'application/json')}
                className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">capacitor.config.json</p>
                    <p className="text-[10px] text-slate-500">Bridge Configuration</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-display">
                  <Terminal className="w-4 h-4 text-red-400" />
                  Method 1: Build Signed Android APK with Google Bubblewrap (TWA)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  The recommended Google standard to turn any PWA into a high-performance Google Play Store APK / AAB package in 3 terminal steps.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bubblewrapCode);
                  setCopiedBubblewrap(true);
                  setTimeout(() => setCopiedBubblewrap(false), 2000);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedBubblewrap ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBubblewrap ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-slate-300 font-mono text-xs overflow-x-auto leading-relaxed">
              {bubblewrapCode}
            </pre>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-display">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Method 2: Wrap into Full Native Android Studio Project via Capacitor
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Creates an Android Studio Gradle project (`android/`) allowing full access to custom native Android Java/Kotlin SDKs, background services, and hardware APIs.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(capacitorCode);
                  setCopiedCapacitor(true);
                  setTimeout(() => setCopiedCapacitor(false), 2000);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCapacitor ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCapacitor ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-slate-300 font-mono text-xs overflow-x-auto leading-relaxed">
              {capacitorCode}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: LOCK SCREEN & WIDGET SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          {/* Real-World Configuration Guide */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-2 font-display">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              Android 1-Tap Lock-Screen Widget Setup
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Configure a direct lock-screen widget using native Android shortcuts. Follow these simple steps:
            </p>

            <div className="space-y-3">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-semibold text-slate-200">Copy the Action Link</p>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Copy your customized rapid action URL below. This query link bypasses normal splash screens to trigger an immediate SOS broadcast.
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      readOnly
                      value={triggerUrl}
                      className="flex-1 text-[10px] font-mono px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 outline-none select-all"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                      title="Copy link"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-200">Add to Android Lock Screen or Power Button</p>
                  <div className="text-[10px] text-slate-400 leading-normal space-y-1.5 mt-1">
                    <p>
                      <strong>🤖 Android Setup:</strong> On your Android home screen, long-press, select <strong className="text-slate-300">"Widgets"</strong>, pick Chrome or SafeLink, and place the 1-tap SOS trigger on your screen!
                    </p>
                    <p>
                      <strong> Apple iOS Setup:</strong> Open the built-in <strong className="text-slate-300">"Shortcuts"</strong> app, add an action <strong className="text-slate-300">"Open URLs"</strong>, paste the link above, and add the Shortcuts lock-screen widget.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LOCK SCREEN WIDGET SIMULATOR */}
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
                  <Tablet className="w-4 h-4 text-emerald-400" />
                  Interactive Android Lock-Screen Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Test how the 1-Tap SOS hardware trigger works when your device is locked.
                </p>
              </div>
              <button
                onClick={() => setWidgetLocked(!widgetLocked)}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition cursor-pointer"
              >
                {widgetLocked ? 'Unlock Screen' : 'Lock Screen'}
              </button>
            </div>

            <div className="flex justify-center p-4">
              <div className="w-[300px] h-[540px] bg-zinc-950 border-[6px] border-zinc-850 rounded-[40px] shadow-2xl p-4 flex flex-col justify-between relative overflow-hidden text-center select-none">
                
                {/* Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono px-2 pt-1">
                  <span>5G</span>
                  <div className="w-16 h-3 bg-zinc-900 rounded-full mx-auto" />
                  <span>100% 🔋</span>
                </div>

                {/* Clock & Date */}
                <div className="space-y-1 mt-6">
                  <div className="text-4xl font-extrabold tracking-tight font-display text-zinc-100">
                    {phoneTime || '12:00'}
                  </div>
                  <div className="text-xs font-medium text-zinc-400">
                    {phoneDate || 'Monday, Oct 24'}
                  </div>
                </div>

                {/* Interactive Lockscreen Widget Pill */}
                <div className="my-auto space-y-3 px-2">
                  <div className="p-3 bg-zinc-900/90 border border-red-500/40 rounded-2xl shadow-lg backdrop-blur space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                        <ShieldAlert className="w-3 h-3 text-red-500" />
                        SafeLink Widget
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>

                    <button
                      onClick={() => {
                        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                        onWidgetTrigger();
                      }}
                      className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-950/60 transition flex items-center justify-center gap-1.5 cursor-pointer border border-red-400/30"
                    >
                      <Zap className="w-4 h-4 fill-white" />
                      <span>TAP TO TRIGGER SOS</span>
                    </button>
                    <p className="text-[8px] text-zinc-400">Bypasses lock screen and initiates live GPS dispatch</p>
                  </div>
                </div>

                {/* Bottom Bar */}
                <div className="space-y-2 pb-2">
                  <div className="w-24 h-1 bg-zinc-700 rounded-full mx-auto" />
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">
                    {widgetLocked ? 'Swipe up to unlock' : 'Unlocked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

