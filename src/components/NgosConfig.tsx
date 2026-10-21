import React, { useState } from 'react';
import { Ngo, PoliceStation } from '../types';
import { 
  Building2, Phone, Mail, MapPin, Plus, Trash2, 
  ShieldCheck, AlertCircle, Compass, Check, Search, ToggleLeft, ToggleRight, Radio, Landmark
} from 'lucide-react';
import { calculateDistance } from '../utils/geo';

interface NgosConfigProps {
  ngos: Ngo[];
  policeStations: PoliceStation[];
  onSaveNgos: (updated: Ngo[]) => void;
  onSavePoliceStations: (updated: PoliceStation[]) => void;
  currentCoords: { lat: number; lng: number } | null;
}

export default function NgosConfig({
  ngos,
  policeStations,
  onSaveNgos,
  onSavePoliceStations,
  currentCoords
}: NgosConfigProps) {
  // Tabs: 'ngos' | 'police'
  const [subTab, setSubTab] = useState<'ngos' | 'police'>('ngos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Form States
  const [isAddingNgo, setIsAddingNgo] = useState(false);
  const [isAddingPolice, setIsAddingPolice] = useState(false);

  // New NGO Form
  const [ngoName, setNgoName] = useState('');
  const [ngoPhone, setNgoPhone] = useState('');
  const [ngoEmail, setNgoEmail] = useState('');
  const [ngoAddress, setNgoAddress] = useState('');
  const [ngoCategory, setNgoCategory] = useState('Crisis Support & Legal Aid');
  const [ngoLat, setNgoLat] = useState('37.7749');
  const [ngoLng, setNgoLng] = useState('-122.4194');

  // New Police Form
  const [policeName, setPoliceName] = useState('');
  const [policePhone, setPolicePhone] = useState('');
  const [policeAddress, setPoliceAddress] = useState('');
  const [policeLat, setPoliceLat] = useState('37.7749');
  const [policeLng, setPoliceLng] = useState('-122.4194');

  // Current simulation reference coordinates (San Francisco default if GPS off)
  const referenceCoords = currentCoords || { lat: 37.7749, lng: -122.4194 };

  const handleAddNgoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ngoName || !ngoPhone) return;

    const newNgo: Ngo = {
      id: `ngo-custom-${Date.now()}`,
      name: ngoName,
      phone: ngoPhone,
      email: ngoEmail || 'support@custom-ngo.org',
      address: ngoAddress || 'Custom Registered Address',
      category: ngoCategory,
      latitude: parseFloat(ngoLat) || 37.7749,
      longitude: parseFloat(ngoLng) || -122.4194,
      isActive: true
    };

    onSaveNgos([...ngos, newNgo]);
    
    // Reset form
    setNgoName('');
    setNgoPhone('');
    setNgoEmail('');
    setNgoAddress('');
    setIsAddingNgo(false);
  };

  const handleAddPoliceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policeName || !policePhone) return;

    const newPolice: PoliceStation = {
      id: `police-custom-${Date.now()}`,
      name: policeName,
      phone: policePhone,
      address: policeAddress || 'Custom Police Address',
      latitude: parseFloat(policeLat) || 37.7749,
      longitude: parseFloat(policeLng) || -122.4194,
      isActive: true
    };

    onSavePoliceStations([...policeStations, newPolice]);

    // Reset form
    setPoliceName('');
    setPolicePhone('');
    setPoliceAddress('');
    setIsAddingPolice(false);
  };

  const handleToggleNgo = (id: string) => {
    const updated = ngos.map(n => n.id === id ? { ...n, isActive: !n.isActive } : n);
    onSaveNgos(updated);
  };

  const handleTogglePolice = (id: string) => {
    const updated = policeStations.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p);
    onSavePoliceStations(updated);
  };

  const handleDeleteNgo = (id: string) => {
    onSaveNgos(ngos.filter(n => n.id !== id));
  };

  const handleDeletePolice = (id: string) => {
    onSavePoliceStations(policeStations.filter(p => p.id !== id));
  };

  // Helper to calculate distance for displaying and sorting
  const getNgoWithDistance = (ngo: Ngo) => {
    const dist = calculateDistance(
      referenceCoords.lat,
      referenceCoords.lng,
      ngo.latitude,
      ngo.longitude
    );
    return { ...ngo, distance: dist };
  };

  const getPoliceWithDistance = (ps: PoliceStation) => {
    const dist = calculateDistance(
      referenceCoords.lat,
      referenceCoords.lng,
      ps.latitude,
      ps.longitude
    );
    return { ...ps, distance: dist };
  };

  // Process lists: Sort by distance so "nearest" is ALWAYS shown first!
  const sortedNgos = ngos
    .map(getNgoWithDistance)
    .sort((a, b) => a.distance - b.distance)
    .filter(ngo => 
      ngo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ngo.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const sortedPolice = policeStations
    .map(getPoliceWithDistance)
    .sort((a, b) => a.distance - b.distance)
    .filter(ps => 
      ps.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ps.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-6" id="ngos-config-root">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span>NGOs & Local Authorities</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure women safety NGOs and police districts. When SOS is triggered, automatic emergency dispatches are instantly broadcasted to the nearest active centers.
          </p>
        </div>

        {/* SUBTAB CONTROLLER */}
        <div className="flex bg-slate-950 border border-slate-900 p-1 rounded-xl self-start">
          <button
            onClick={() => { setSubTab('ngos'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'ngos' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Safety NGOs ({ngos.length})</span>
          </button>
          <button
            onClick={() => { setSubTab('police'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'police' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Police Stations ({policeStations.length})</span>
          </button>
        </div>
      </div>

      {/* GPS ACTIVE STATUS BAR */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute inset-0"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative"></div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Dynamic Geofenced Core</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded">Active</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {currentCoords 
                ? `Using live client GPS: Lat ${currentCoords.lat.toFixed(4)}, Lng ${currentCoords.lng.toFixed(4)}`
                : 'Using default reference center: San Francisco Metropolitan Area'}
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Nearest responder prioritized on broadcast trigger</span>
        </div>
      </div>

      {/* SEARCH AND ADD CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search nearby ${subTab === 'ngos' ? 'support NGOs' : 'precinct stations'} by name or street...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-900 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-550 outline-none focus:border-indigo-500/50"
          />
        </div>

        <button
          onClick={() => subTab === 'ngos' ? setIsAddingNgo(true) : setIsAddingPolice(true)}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom {subTab === 'ngos' ? 'NGO' : 'Station'}</span>
        </button>
      </div>

      {/* ADD NGO DIALOG */}
      {isAddingNgo && (
        <div className="bg-slate-950 border border-slate-900 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Add Custom NGO Support Center</h3>
            <button onClick={() => setIsAddingNgo(false)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
          </div>

          <form onSubmit={handleAddNgoSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">NGO Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Hope Women Safety Alliance"
                value={ngoName}
                onChange={(e) => setNgoName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">Emergency Hot-line *</label>
              <input
                type="text"
                required
                placeholder="e.g. +1 (555) 123-4567"
                value={ngoPhone}
                onChange={(e) => setNgoPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">Contact Email</label>
              <input
                type="email"
                placeholder="e.g. emergency@hopealliance.org"
                value={ngoEmail}
                onChange={(e) => setNgoEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">Support Classification</label>
              <select
                value={ngoCategory}
                onChange={(e) => setNgoCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="Crisis Support & Legal Aid">Crisis Support & Legal Aid</option>
                <option value="Emergency Rescue & Safe Transit">Emergency Rescue & Safe Transit</option>
                <option value="Temporary Safe-House Shelter">Temporary Safe-House Shelter</option>
                <option value="24/7 Helpline & Counseling">24/7 Helpline & Counseling</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400">Physical Address</label>
              <input
                type="text"
                placeholder="e.g. 101 Safe Harbor Boulevard, Suite B"
                value={ngoAddress}
                onChange={(e) => setNgoAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 font-mono">Latitude (Simulation GPS)</label>
              <input
                type="number"
                step="0.0001"
                value={ngoLat}
                onChange={(e) => setNgoLat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 font-mono">Longitude (Simulation GPS)</label>
              <input
                type="number"
                step="0.0001"
                value={ngoLng}
                onChange={(e) => setNgoLng(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Save and Map New NGO
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD POLICE DIALOG */}
      {isAddingPolice && (
        <div className="bg-slate-950 border border-slate-900 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Add Custom Police Station</h3>
            <button onClick={() => setIsAddingPolice(false)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
          </div>

          <form onSubmit={handleAddPoliceSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">Station / Precinct Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Park District Precinct HQ"
                value={policeName}
                onChange={(e) => setPoliceName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400">Control Desk Phone *</label>
              <input
                type="text"
                required
                placeholder="e.g. +1 (555) 911-0055"
                value={policePhone}
                onChange={(e) => setPolicePhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400">Precinct Address</label>
              <input
                type="text"
                placeholder="e.g. 55 Sector 10 Police Plaza"
                value={policeAddress}
                onChange={(e) => setPoliceAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 font-mono">Latitude (Simulation GPS)</label>
              <input
                type="number"
                step="0.0001"
                value={policeLat}
                onChange={(e) => setPoliceLat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 font-mono">Longitude (Simulation GPS)</label>
              <input
                type="number"
                step="0.0001"
                value={policeLng}
                onChange={(e) => setPoliceLng(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Save Police Station
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DISPATCH MATRIX RESULTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subTab === 'ngos' ? (
          sortedNgos.length === 0 ? (
            <div className="md:col-span-2 border border-dashed border-slate-900 rounded-3xl py-12 text-center text-slate-500 text-xs">
              No women safety NGOs found matching "{searchQuery}".
            </div>
          ) : (
            sortedNgos.map((ngo, index) => (
              <div 
                key={ngo.id}
                className={`border rounded-2xl p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  ngo.isActive 
                    ? 'bg-indigo-950/20 border-indigo-900/60 shadow-lg shadow-indigo-950/10' 
                    : 'bg-slate-950/40 border-slate-900/80 grayscale opacity-60'
                }`}
              >
                {/* Distance Badge */}
                <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-850 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold text-indigo-400 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-indigo-500" />
                  <span>{ngo.distance} km</span>
                  {index === 0 && <span className="text-[8px] bg-indigo-900 text-indigo-200 px-1 rounded ml-1 font-sans">NEAREST</span>}
                </div>

                <div className="space-y-3">
                  <div className="pr-20">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400/80 block font-mono">
                      {ngo.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-1 leading-snug">
                      {ngo.name}
                    </h4>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-300">{ngo.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-400">{ngo.email}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-slate-400 text-[11px] leading-tight">{ngo.address}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/80 mt-4 pt-3.5">
                  <button
                    onClick={() => handleToggleNgo(ngo.id)}
                    className={`text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                      ngo.isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    {ngo.isActive ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <span>Active SOS Responder</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-slate-600" />
                        <span>SOS Trigger Offline</span>
                      </>
                    )}
                  </button>

                  {ngo.id.startsWith('ngo-custom') && (
                    <button
                      onClick={() => handleDeleteNgo(ngo.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-900 transition"
                      title="Remove Custom NGO"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        ) : (
          sortedPolice.length === 0 ? (
            <div className="md:col-span-2 border border-dashed border-slate-900 rounded-3xl py-12 text-center text-slate-500 text-xs">
              No police stations found matching "{searchQuery}".
            </div>
          ) : (
            sortedPolice.map((ps, index) => (
              <div 
                key={ps.id}
                className={`border rounded-2xl p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  ps.isActive 
                    ? 'bg-indigo-950/20 border-indigo-900/60 shadow-lg shadow-indigo-950/10' 
                    : 'bg-slate-950/40 border-slate-900/80 grayscale opacity-60'
                }`}
              >
                {/* Distance Badge */}
                <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-850 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold text-indigo-400 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-indigo-500" />
                  <span>{ps.distance} km</span>
                  {index === 0 && <span className="text-[8px] bg-indigo-900 text-indigo-200 px-1 ml-1 rounded font-sans">NEAREST</span>}
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400/80 block font-mono">
                      Law Enforcement Unit
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-1 leading-snug">
                      {ps.name}
                    </h4>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-300">{ps.phone}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-slate-400 text-[11px] leading-tight">{ps.address}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/80 mt-4 pt-3.5">
                  <button
                    onClick={() => handleTogglePolice(ps.id)}
                    className={`text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                      ps.isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    {ps.isActive ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <span>Dispatched Automatically</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-slate-600" />
                        <span>Precinct Alert Bypassed</span>
                      </>
                    )}
                  </button>

                  {ps.id.startsWith('police-custom') && (
                    <button
                      onClick={() => handleDeletePolice(ps.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-900 transition"
                      title="Remove Custom Station"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* DISPATCH ALGORITHM CARD */}
      <div className="bg-slate-950/80 border border-slate-900 p-5 rounded-3xl space-y-3.5">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Emergency Dispatch Logic Matrix</h4>
        <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
          <p>
            When the SOS sequence triggers, the core alert controller processes your current coordinate payload against the active directory using the <strong>Haversine Trigonometric Formula</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
            <li>Identifies the closest registered Women Safety NGO (e.g. {sortedNgos[0]?.name || 'Pre-configured Hub'}) and packages a priority SMS.</li>
            <li>Identifies the closest law-enforcement precinct ({sortedPolice[0]?.name || 'District Precinct'}) and routes current telemetry logs.</li>
            <li>Transmits immediate live GPS location links to all registered parents & Guardian Circle contacts.</li>
            <li>Queues alerts locally for automatic transmission via <strong>Offline Radio/SMS Packets</strong> if network signal drops.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
