import React, { useState } from 'react';
import { EmergencyContact } from '../types';
import { UserPlus, Trash2, Heart, MessageSquare, AlertCircle, Sparkles, Check, PhoneCall, Mail } from 'lucide-react';

interface ContactsConfigProps {
  contacts: EmergencyContact[];
  onSaveContacts: (updated: EmergencyContact[]) => void;
}

export default function ContactsConfig({ contacts, onSaveContacts }: ContactsConfigProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customMessage, setCustomMessage] = useState(
    'SOS: [MAP_LINK]'
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const messageTemplates = [
    {
      label: '🚨 Short SOS Alert',
      text: 'SOS: [MAP_LINK]'
    }
  ];

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Contact Name is required.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError('Please provide at least a Phone Number or an Email address.');
      return;
    }

    const newContact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customMessage: customMessage.trim() || 'SOS: [MAP_LINK]',
      isActive: true
    };

    const updated = [...contacts, newContact];
    onSaveContacts(updated);
    
    // Clear form
    setName('');
    setPhone('');
    setEmail('');
    setSuccess(`Successfully added contact "${newContact.name}"`);

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleRemoveContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    onSaveContacts(updated);
  };

  const handleToggleActive = (id: string) => {
    const updated = contacts.map((c) => {
      if (c.id === id) {
        return { ...c, isActive: !c.isActive };
      }
      return c;
    });
    onSaveContacts(updated);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 font-display">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            Emergency Guard Circle ({contacts.length})
          </h3>
          <span className="self-start sm:self-auto bg-indigo-950/80 text-indigo-400 border border-indigo-900 text-[9px] font-black uppercase font-mono py-1 px-2.5 rounded-full flex items-center gap-1.5 animate-pulse">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Automated Carrier Gateway</span>
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Add up to 5 trusted friends, family members, or emergency responders. When SOS activates, SafeLink's backend automatically dispatches a real-time emergency SMS carrying your live coordinates tracking room URL to their mobile devices.
        </p>

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-4">
            <AlertCircle className="w-8 h-8 text-amber-500/80 mb-2 animate-bounce" />
            <p className="text-xs font-medium text-slate-300">No Trusted Contacts Configured</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[260px]">
              You must set up at least one contact to broadcast coordinates and route logs!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {contacts.map((contact) => (
              <div 
                key={contact.id} 
                className={`p-3 rounded-xl border transition flex items-center justify-between ${
                  contact.isActive 
                    ? 'bg-slate-950/60 border-slate-800' 
                    : 'bg-slate-950/15 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {contact.name}
                    </span>
                    {!contact.isActive && (
                      <span className="text-[9px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-0.5">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <PhoneCall className="w-2.5 h-2.5 text-slate-500" />
                        {contact.phone}
                      </span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5 text-slate-500" />
                        {contact.email}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-1 truncate max-w-sm">
                    "{contact.customMessage}"
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition flex items-center justify-center"
                      title={`Call ${contact.name}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleToggleActive(contact.id)}
                    className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
                      contact.isActive 
                        ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                    title={contact.isActive ? 'Deactivate contact' : 'Activate contact'}
                  >
                    <Check className="w-3.5 h-3.5 font-bold" />
                  </button>
                  <button
                    onClick={() => handleRemoveContact(contact.id)}
                    className="p-1.5 bg-slate-950 border border-slate-850 hover:border-red-950 rounded-lg text-slate-500 hover:text-red-400 transition"
                    title="Remove Contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact Form */}
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3 font-display">
          <UserPlus className="w-4 h-4 text-emerald-400" />
          Add Trusted Guardian
        </h3>

        {error && (
          <div className="mb-3 p-2.5 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-3 p-2.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleAddContact} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-850 focus:border-red-500/55 rounded-xl text-slate-100 outline-none transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Phone Number (for SMS)
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 019-2834"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-850 focus:border-red-500/55 rounded-xl text-slate-100 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Email Address
            </label>
            <input
              type="email"
              placeholder="guardian@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-850 focus:border-red-500/55 rounded-xl text-slate-100 outline-none transition"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Custom SOS Message
              </label>
              <span className="text-[9px] text-slate-500 font-mono">
                [MAP_LINK] will automatically insert coordinates link
              </span>
            </div>
            
            <textarea
              rows={2}
              placeholder="Type custom dispatch message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-850 focus:border-red-500/55 rounded-xl text-slate-100 outline-none transition resize-none font-sans"
            />

            <p className="text-[9px] text-amber-500/80 leading-relaxed font-medium">
              💡 Keep your message under 160 characters and avoid emojis inside SMS text to prevent Twilio multi-segment charges and optimize billing credits.
            </p>

            {/* Quick message templates */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {messageTemplates.map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomMessage(template.text)}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg text-[9px] font-medium text-slate-400 hover:text-slate-200 transition"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add to Safety Ring</span>
          </button>
        </form>
      </div>
    </div>
  );
}
