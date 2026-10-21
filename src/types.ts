export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  customMessage: string;
  isActive: boolean;
}

export interface LocationLog {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  status: 'uncomfortable' | 'normal' | 'sos';
}

export interface AudioRecord {
  id: string;
  blobUrl: string;
  name: string;
  durationSec: number;
  timestamp: string;
  sizeStr: string;
}

export interface AppSettings {
  triggerPhrase: string;
  shakeSensitivity: number; // m/s^2 acceleration threshold (default: 50 m/s^2 emergency intensity)
  shakeCountRequired?: number; // consecutive shakes required to prevent accidental triggers (default: 2)
  voiceSensitivity?: 'strict' | 'flexible'; // strict exact match vs flexible phrase inclusion
  wakeWordLanguage?: string; // language locale for Speech Recognition
  isStealthMode: boolean;
  decoyType: 'calculator' | 'news';
  autoRecordDurationSec: number;
  useSirensOnSOS: boolean;
  useBeepOnTriggers: boolean;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  theme?: 'dark' | 'light';
}

export interface OfflineQueueItem {
  id: string;
  type: 'sms' | 'email';
  recipient: string;
  content: string;
  timestamp: string;
}

export interface Ngo {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface PoliceStation {
  id: string;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface CommunityAlert {
  id: string;
  userId: string;
  userName: string;
  incidentType: 'harassment' | 'suspicious' | 'danger' | 'accident' | 'medical' | 'hazard' | 'other';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  active: boolean;
  upvotes: string[]; // Array of user UIDs who confirmed/verified this alert
  isAnonymous?: boolean;
}

