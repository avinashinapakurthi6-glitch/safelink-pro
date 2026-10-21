import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  onSnapshot, 
  collection,
  updateDoc,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { EmergencyContact, AppSettings, LocationLog, Ngo, PoliceStation, AudioRecord, CommunityAlert } from '../types';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "spartan-vertex-470305-t6",
  appId: "1:656428255428:web:e840802b74549f2d36e191",
  apiKey: "AIzaSyAYfpOSpQw0ARrAVNrS39M91xG7q4OjmVk",
  authDomain: "spartan-vertex-470305-t6.firebaseapp.com",
  storageBucket: "spartan-vertex-470305-t6.firebasestorage.app",
  messagingSenderId: "656428255428"
};

// custom firestore database ID from firebase-applet-config.json
const databaseId = "ai-studio-safelinksos-eef212d6-c107-4a47-ab84-41badc5cfb44";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, databaseId);

// Test connection to Firestore asynchronously in background without blocking initial app render
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or connectivity.");
    }
  }
}

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      testConnection().catch(() => {});
    });
  } else {
    setTimeout(() => {
      testConnection().catch(() => {});
    }, 2500);
  }
}

const googleProvider = new GoogleAuthProvider();

// Google Sign-in with fallback instructions
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google popup blocked/failed, trying redirect fallback or demo credentials...", error);
    throw error;
  }
}

// Anonymous / Demo user fallback for simple iframe testing
export async function signInAsGuest() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    console.error("Anonymous sign-in failed:", error);
    throw error;
  }
}

export async function logOut() {
  await signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Save all user data to Firestore
export async function saveUserData(
  userId: string, 
  data: {
    contacts?: EmergencyContact[];
    settings?: AppSettings;
    locationLogs?: LocationLog[];
    ngos?: Ngo[];
    policeStations?: PoliceStation[];
    audioRecords?: AudioRecord[];
  }
) {
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Failed to save user data to Firestore:", err);
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
  }
}

// Load all user data from Firestore
export async function loadUserData(userId: string) {
  const userRef = doc(db, 'users', userId);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error("Failed to load user data from Firestore:", err);
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
  }
  return null;
}

// Initialize/Update Live SOS tracking session
export async function startLiveSosSession(
  sessionId: string,
  data: {
    userId: string;
    userName: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    reason: string;
    timestamp: string;
    logs: string[];
  }
) {
  const sessionRef = doc(db, 'live_sos', sessionId);
  try {
    await setDoc(sessionRef, {
      ...data,
      active: true,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to start Live SOS session:", err);
    handleFirestoreError(err, OperationType.WRITE, `live_sos/${sessionId}`);
  }
}

export async function updateLiveSosLocation(
  sessionId: string,
  coords: { latitude: number; longitude: number; accuracy: number },
  logs: string[]
) {
  const sessionRef = doc(db, 'live_sos', sessionId);
  try {
    await updateDoc(sessionRef, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      logs: logs,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    // If update fails, session might not exist yet, we try to merge
    try {
      await setDoc(sessionRef, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        logs: logs,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to update Live SOS coordinates:", e);
      handleFirestoreError(e, OperationType.WRITE, `live_sos/${sessionId}`);
    }
  }
}

export async function stopLiveSosSession(sessionId: string) {
  const sessionRef = doc(db, 'live_sos', sessionId);
  try {
    await updateDoc(sessionRef, {
      active: false,
      endedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to stop Live SOS session:", err);
    handleFirestoreError(err, OperationType.WRITE, `live_sos/${sessionId}`);
  }
}

// Subscribe to real-time live SOS session (for guardian tracking page)
export function subscribeToLiveSos(sessionId: string, callback: (data: any) => void) {
  const sessionRef = doc(db, 'live_sos', sessionId);
  return onSnapshot(sessionRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `live_sos/${sessionId}`);
  });
}

// Create a new Community Alert
export async function createCommunityAlert(
  data: Omit<CommunityAlert, 'id' | 'createdAt' | 'upvotes' | 'active'>
) {
  const alertCollection = collection(db, 'community_alerts');
  const alertRef = doc(alertCollection);
  const newAlert: CommunityAlert = {
    ...data,
    id: alertRef.id,
    createdAt: new Date().toISOString(),
    active: true,
    upvotes: []
  };

  try {
    await setDoc(alertRef, newAlert);
    return newAlert;
  } catch (err) {
    console.error("Failed to create community alert:", err);
    handleFirestoreError(err, OperationType.WRITE, `community_alerts/${alertRef.id}`);
  }
}

// Subscribe to community alerts
export function subscribeToCommunityAlerts(callback: (alerts: CommunityAlert[]) => void) {
  const alertsCollection = collection(db, 'community_alerts');
  const q = query(alertsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const alerts: CommunityAlert[] = [];
    snapshot.forEach((docSnap) => {
      alerts.push(docSnap.data() as CommunityAlert);
    });
    callback(alerts);
  }, (err) => {
    console.error("Failed to subscribe to community alerts:", err);
    handleFirestoreError(err, OperationType.GET, 'community_alerts');
  });
}

// Toggle upvote / verify community alert
export async function toggleUpvoteCommunityAlert(alertId: string, userId: string) {
  const alertRef = doc(db, 'community_alerts', alertId);
  try {
    const snap = await getDoc(alertRef);
    if (snap.exists()) {
      const alert = snap.data() as CommunityAlert;
      const upvotes = alert.upvotes || [];
      const updatedUpvotes = upvotes.includes(userId)
        ? upvotes.filter(id => id !== userId)
        : [...upvotes, userId];
      
      await updateDoc(alertRef, { upvotes: updatedUpvotes });
    }
  } catch (err) {
    console.error("Failed to toggle upvote on community alert:", err);
    handleFirestoreError(err, OperationType.WRITE, `community_alerts/${alertId}`);
  }
}

// Resolve/Deactivate community alert
export async function toggleResolveCommunityAlert(alertId: string, active: boolean) {
  const alertRef = doc(db, 'community_alerts', alertId);
  try {
    await updateDoc(alertRef, { active });
  } catch (err) {
    console.error("Failed to resolve community alert:", err);
    handleFirestoreError(err, OperationType.WRITE, `community_alerts/${alertId}`);
  }
}

// Delete community alert
export async function deleteCommunityAlert(alertId: string) {
  const alertRef = doc(db, 'community_alerts', alertId);
  try {
    await deleteDoc(alertRef);
  } catch (err) {
    console.error("Failed to delete community alert:", err);
    handleFirestoreError(err, OperationType.DELETE, `community_alerts/${alertId}`);
  }
}

