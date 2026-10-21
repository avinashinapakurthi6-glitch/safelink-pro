import React, { useState, useEffect } from 'react';
import { CommunityAlert } from '../types';
import { 
  createCommunityAlert, 
  toggleUpvoteCommunityAlert, 
  toggleResolveCommunityAlert, 
  deleteCommunityAlert,
  subscribeToCommunityAlerts
} from '../utils/firebase';
import { User as AuthUser } from 'firebase/auth';
import { 
  Bell, Users, AlertTriangle, Plus, MapPin, ThumbsUp, CheckCircle, 
  Trash2, ShieldAlert, Clock, Check, EyeOff, Radio, ListFilter, ShieldCheck
} from 'lucide-react';

interface CommunityAlertsProps {
  user: AuthUser | null;
  currentCoords: { lat: number; lng: number; acc: number } | null;
  onAddDispatchLog?: (log: string) => void;
}

export default function CommunityAlerts({ user, currentCoords, onAddDispatchLog }: CommunityAlertsProps) {
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  
  // Form State
  const [showReportForm, setShowReportForm] = useState(false);
  const [incidentType, setIncidentType] = useState<CommunityAlert['incidentType']>('suspicious');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<CommunityAlert['severity']>('medium');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to community alerts on mount
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCommunityAlerts((fetchedAlerts) => {
      setAlerts(fetchedAlerts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Set default form coordinates if currentCoords are available
  useEffect(() => {
    if (currentCoords) {
      setManualCoords({
        lat: currentCoords.lat.toFixed(6),
        lng: currentCoords.lng.toFixed(6)
      });
    }
  }, [currentCoords]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!title.trim()) {
      setFormError('Please enter a brief title/header.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please describe the safety incident detail.');
      return;
    }

    const latVal = parseFloat(manualCoords.lat);
    const lngVal = parseFloat(manualCoords.lng);

    if (isNaN(latVal) || isNaN(lngVal)) {
      setFormError('Please provide valid latitude and longitude coordinates.');
      return;
    }

    setSubmitting(true);
    
    // User credentials fallback
    const userId = user?.uid || 'guest-user';
    const userName = isAnonymous 
      ? 'Anonymous Citizen' 
      : user?.displayName || user?.email?.split('@')[0] || 'Guest Citizen';

    try {
      await createCommunityAlert({
        userId,
        userName,
        incidentType,
        title: title.trim(),
        description: description.trim(),
        latitude: latVal,
        longitude: lngVal,
        severity,
        isAnonymous
      });

      setFormSuccess('Community safety alert successfully broadcasted!');
      
      // Reset form fields
      setTitle('');
      setDescription('');
      setIsAnonymous(false);
      setShowReportForm(false);
      
      if (onAddDispatchLog) {
        onAddDispatchLog(`📢 Community Alert published: "${title.trim()}"`);
      }
    } catch (err: any) {
      console.error(err);
      setFormError('Failed to publish community alert. Ensure you have active connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (alertId: string) => {
    if (!user) {
      alert('Please use the dashboard tab to authenticate first to verify community alerts.');
      return;
    }
    try {
      await toggleUpvoteCommunityAlert(alertId, user.uid);
      if (onAddDispatchLog) {
        onAddDispatchLog(`✓ Voted verification on community alert ID: ${alertId.substring(0, 8)}...`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleResolve = async (alertId: string, currentStatus: boolean) => {
    try {
      await toggleResolveCommunityAlert(alertId, !currentStatus);
      if (onAddDispatchLog) {
        onAddDispatchLog(`✓ Alert ${alertId.substring(0, 8)}... marked as ${!currentStatus ? 'Active' : 'Resolved'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) return;
    try {
      await deleteCommunityAlert(alertId);
      if (onAddDispatchLog) {
        onAddDispatchLog(`✗ Deleted community alert ID: ${alertId.substring(0, 8)}...`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const prefillCurrentGps = () => {
    if (currentCoords) {
      setManualCoords({
        lat: currentCoords.lat.toFixed(6),
        lng: currentCoords.lng.toFixed(6)
      });
      setFormSuccess('Successfully filled current coordinates from active satellite GPS tracker!');
      setTimeout(() => setFormSuccess(''), 3000);
    } else {
      setFormError('No GPS coordinate found. Please ensure GPS/Location is enabled on the device/tab.');
    }
  };

  // Filter logic
  const filteredAlerts = filterActiveOnly 
    ? alerts.filter(a => a.active) 
    : alerts;

  const getIncidentBadgeStyles = (type: CommunityAlert['incidentType']) => {
    switch(type) {
      case 'danger':
        return 'bg-red-500/10 text-red-400 border border-red-500/25';
      case 'harassment':
        return 'bg-pink-500/10 text-pink-400 border border-pink-500/25';
      case 'accident':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/25';
      case 'medical':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'suspicious':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'hazard':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/25';
    }
  };

  const getSeverityBadgeStyles = (sev: CommunityAlert['severity']) => {
    switch(sev) {
      case 'high':
        return 'bg-red-500 text-slate-950 font-extrabold';
      case 'medium':
        return 'bg-amber-500 text-slate-950 font-bold';
      default:
        return 'bg-sky-500 text-slate-950 font-medium';
    }
  };

  return (
    <div id="community-safety-hub" className="space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 border border-slate-900/60 p-5 rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl mt-0.5">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Community Safety Alerts
              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-mono border border-red-500/20 rounded-full">
                LIVE BROADCAST
              </span>
            </h1>
            <p className="text-xs text-slate-400 leading-normal mt-0.5">
              Secure the community by reporting real-time hazards, safety risks, or emergency incidents.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg self-start sm:self-center"
        >
          {showReportForm ? <ListFilter className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showReportForm ? 'View Feed' : 'Broadcast Alert'}</span>
        </button>
      </div>

      {showReportForm ? (
        /* REPORT INCIDENT FORM */
        <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl space-y-4">
          <div className="border-b border-slate-900 pb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Submit Safety Incident Report
            </h2>
          </div>

          <form onSubmit={handleReportSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* INCIDENT TYPE */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Incident Category
                </label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as CommunityAlert['incidentType'])}
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl text-slate-200 outline-none focus:border-red-500/50"
                >
                  <option value="suspicious">⚠️ Suspicious Activity</option>
                  <option value="harassment">⚠️ Active Harassment / Eve-Teasing</option>
                  <option value="danger">🚨 Direct Danger / Violence</option>
                  <option value="accident">🚗 Traffic Accident / Roadblock</option>
                  <option value="medical">🚑 Medical Emergency</option>
                  <option value="hazard">⚡ Electrical / Safety Hazard</option>
                  <option value="other">📌 Other Concern</option>
                </select>
              </div>

              {/* SEVERITY SELECTION */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Severity Scale
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as CommunityAlert['severity'][]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition capitalize ${
                        severity === sev 
                          ? sev === 'high' 
                            ? 'bg-red-500/20 border-red-500 text-red-400'
                            : sev === 'medium'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                              : 'bg-sky-500/20 border-sky-500 text-sky-400'
                          : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* ALERT TITLE */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Alert Title / Headline
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Unattended suspicious package near metro entrance, Active harassment on Sector 4 lane"
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl text-slate-200 outline-none focus:border-red-500/50 font-medium"
                />
              </div>

              {/* DESCRIPTION DETAILS */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Incident Details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the situation clearly to help secure others. Provide details on appearance, exact landmark, and advice."
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl text-slate-200 outline-none focus:border-red-500/50 resize-none"
                />
              </div>

              {/* COORDINATES */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block flex items-center justify-between">
                  <span>Latitude Coordinate</span>
                  <button
                    type="button"
                    onClick={prefillCurrentGps}
                    className="text-[9px] text-emerald-400 font-bold tracking-normal underline uppercase hover:text-emerald-300"
                  >
                    Load From Active GPS
                  </button>
                </label>
                <input
                  type="text"
                  value={manualCoords.lat}
                  onChange={(e) => setManualCoords(prev => ({ ...prev, lat: e.target.value }))}
                  placeholder="e.g. 12.971598"
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl text-slate-200 outline-none focus:border-red-500/50 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Longitude Coordinate
                </label>
                <input
                  type="text"
                  value={manualCoords.lng}
                  onChange={(e) => setManualCoords(prev => ({ ...prev, lng: e.target.value }))}
                  placeholder="e.g. 77.594562"
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2.5 rounded-xl text-slate-200 outline-none focus:border-red-500/50 font-mono"
                />
              </div>

              {/* ANONYMOUS */}
              <div className="md:col-span-2 py-2 flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <input
                    id="is-anonymous-alert"
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="mt-1 rounded border-slate-800 text-red-500 focus:ring-red-500/50 bg-slate-950"
                  />
                  <label htmlFor="is-anonymous-alert" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Publish Report Anonymously
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Your display name will be masked as "Anonymous Citizen" in the safety feed.
                    </span>
                  </label>
                </div>
              </div>

            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Broadcasting...' : 'Broadcast Immediate Alert'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="px-5 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ALERTS LIST / SAFETY FEED */
        <div className="space-y-4">
          
          {/* LIST CONTROLS */}
          <div className="flex items-center justify-between bg-slate-950/20 border border-slate-900 px-4 py-3 rounded-xl select-none">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <ListFilter className="w-4 h-4 text-slate-500" />
              <span>Safety Feed Filter:</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterActiveOnly(true)}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-lg border transition ${
                  filterActiveOnly
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-transparent border-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setFilterActiveOnly(false)}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-lg border transition ${
                  !filterActiveOnly
                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                    : 'bg-transparent border-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                All Reports
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs font-mono space-y-2">
              <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Establishing secure connection to Community Safety Hub...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/10 border border-slate-900 rounded-2xl space-y-3">
              <ShieldCheck className="w-8 h-8 text-emerald-500/60 mx-auto" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                All Secure / No Active Alerts
              </h3>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-normal">
                There are currently no active community-reported safety threats in your safety feed. Broadcast one if you spot local issues.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredAlerts.map((alert) => {
                const isCreator = user && alert.userId === user.uid;
                const hasVoted = user && alert.upvotes?.includes(user.uid);
                const voteCount = alert.upvotes?.length || 0;

                return (
                  <div 
                    key={alert.id}
                    className={`border rounded-2xl p-5 space-y-3 transition-all ${
                      alert.active 
                        ? alert.severity === 'high'
                          ? 'bg-red-950/10 border-red-950/30'
                          : alert.severity === 'medium'
                            ? 'bg-amber-950/10 border-amber-950/30'
                            : 'bg-slate-900/10 border-slate-900'
                        : 'bg-slate-950/30 border-slate-900/50 opacity-60'
                    }`}
                  >
                    
                    {/* METADATA BAR */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase ${getSeverityBadgeStyles(alert.severity)}`}>
                          {alert.severity} priority
                        </span>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${getIncidentBadgeStyles(alert.incidentType)}`}>
                          {alert.incidentType}
                        </span>

                        {!alert.active && (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-bold border border-slate-750 rounded">
                            RESOLVED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-slate-500 font-medium font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(alert.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>

                    {/* TITLE & DESCRIPTION */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-200">
                        {alert.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                        {alert.description}
                      </p>
                    </div>

                    {/* REPORT INFO */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 border-t border-slate-900 pt-3">
                      <span className="flex items-center gap-1 font-semibold text-slate-400">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>By: {alert.userName}</span>
                      </span>

                      <span className="text-slate-800">|</span>

                      <a 
                        href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                        target="_blank" 
                        rel="referrer"
                        className="flex items-center gap-1 text-red-400 hover:text-red-300 transition"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-red-500/70" />
                        <span>GPS: {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)} (Open Map)</span>
                      </a>
                    </div>

                    {/* ACTION CONTROLS */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900/50">
                      
                      {/* UPVOTE/VERIFY BUTTON */}
                      <button
                        onClick={() => handleUpvote(alert.id)}
                        disabled={!alert.active}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition flex items-center gap-1.5 ${
                          hasVoted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : alert.active
                              ? 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                              : 'bg-transparent border-transparent text-slate-600 cursor-not-allowed'
                        }`}
                        title={hasVoted ? "You have verified this incident alert" : "Verify this alert to alert others"}
                      >
                        {hasVoted ? <Check className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
                        <span>
                          {voteCount === 1 ? '1 Verified Confirmation' : `${voteCount} Verified Confirmations`}
                        </span>
                      </button>

                      {/* OWNER OR ADMIN CONTROLS */}
                      <div className="flex items-center gap-2">
                        {isCreator && (
                          <button
                            onClick={() => handleToggleResolve(alert.id, alert.active)}
                            className={`px-2.5 py-1.5 border text-[9px] font-extrabold uppercase rounded-lg transition flex items-center gap-1 ${
                              alert.active
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                            }`}
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>{alert.active ? 'Mark Resolved' : 'Reactivate'}</span>
                          </button>
                        )}

                        {(isCreator || (user && user.uid === 'guest-user')) && (
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                            title="Delete alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
