import React from 'react';
import { BookOpen, Phone, MapPin, CheckCircle, Shield, ShieldCheck, HeartPulse, Sparkles } from 'lucide-react';

export default function HelpGuides() {
  const hotlines = [
    { name: '🚨 Nationwide Emergency Services', number: '112 / 100 / 911', desc: 'Direct law enforcement dispatch, paramedic team, and rescue services.' },
    { name: '📞 National Women Helpline', number: '1091 / 181', desc: 'Dedicated 24/7 legal support, crisis counseling, and rapid intervention.' },
    { name: '🛡️ Domestic Abuse Helpdesk', number: '1-800-799-SAFE (7233)', desc: 'Confidential peer advice, temporary shelter coordination, and secure escape routes.' },
    { name: '🌐 Cyber Harassment Cell', number: '1930 / Web Portal', desc: 'Reporting non-consensual media leaks, active stalking, or computational blackmail.' }
  ];

  const safetySteps = [
    { title: 'De-escalation Spacers', text: 'If approached, speak in a firm, direct tone. Keep hands in high visual range and maintain an exit path' },
    { title: 'The Shield decoy utility', text: 'Activate our "Stealth Mode" when walking in poorly lit lanes. This conceals your security center under a fully functional news reader or math calculator' },
    { title: 'Voice trigger confidence', text: 'Set your voice safety keyword (default: "help help") so that even if your mobile is stored in your pocket or bag, it automatically dispatches the SOS packets' },
    { title: 'Rapid lock shortcut', text: 'Add the SafeLink 1-Tap widget to your screen for instant launch without typing passcode locks' }
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Dynamic Emergency Hotlines */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3 font-display">
          <Phone className="w-4 h-4 text-rose-500 fill-rose-500/20" />
          Primary Emergency Support Hotlines
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hotlines.map((hotline, idx) => (
            <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 hover:border-slate-850 transition space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 truncate">
                  {hotline.name}
                </span>
                <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                  {hotline.number}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {hotline.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Security Best Practices */}
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3 font-display">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Pre-emptive Personal Defense Strategies
        </h3>

        <div className="space-y-3">
          {safetySteps.map((step, idx) => (
            <div key={idx} className="flex gap-3 items-start p-2.5 hover:bg-slate-900/10 rounded-xl transition">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-200">{step.title}</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust & Data Privacy Seal */}
      <div className="p-4 bg-gradient-to-r from-emerald-500/5 to-slate-950 rounded-2xl border border-emerald-500/10 flex gap-3.5 items-center">
        <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-display">
            Local First Cryptographic Policy
          </h4>
          <p className="text-[10px] text-slate-400 leading-normal max-w-lg">
            SafeLink utilizes on-device local storage to cache coordinates and recordings. No voice audio, camera footage, or tracking logs are ever transmitted to external advertising networks or secondary storage nodes.
          </p>
        </div>
      </div>
    </div>
  );
}
