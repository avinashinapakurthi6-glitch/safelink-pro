// IndexedDB & LocalStorage persistent audio storage manager
import { AudioRecord } from '../types';

const DB_NAME = 'SafeLinkAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_records';
const LOCAL_STORAGE_KEY = 'safelink_audio_records_meta';

// Helper to convert Blob to Base64 Data URL
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to convert Data URL to Blob
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'audio/webm';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function persistAudioRecord(record: AudioRecord, blob?: Blob): Promise<AudioRecord> {
  try {
    let finalDataUrl = record.blobUrl;
    if (blob) {
      finalDataUrl = await blobToDataUrl(blob);
    } else if (record.blobUrl && record.blobUrl.startsWith('blob:')) {
      try {
        const response = await fetch(record.blobUrl);
        const fetchedBlob = await response.blob();
        finalDataUrl = await blobToDataUrl(fetchedBlob);
      } catch (e) {
        console.warn('Could not fetch blob URL for storage conversion:', e);
      }
    }

    const storedItem = {
      ...record,
      dataUrl: finalDataUrl
    };

    // Try IndexedDB first
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(storedItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      console.warn('IndexedDB save failed, using fallback:', idbErr);
    }

    // Also update LocalStorage metadata cache for quick retrieval
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existingList: any[] = existingStr ? JSON.parse(existingStr) : [];
      const updatedList = [
        storedItem,
        ...existingList.filter((item) => item.id !== record.id)
      ].slice(0, 30); // Keep last 30 recordings
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (lsErr) {
      console.warn('LocalStorage save failed:', lsErr);
    }

    return storedItem;
  } catch (err) {
    console.error('Failed to persist audio record:', err);
    return record;
  }
}

export async function loadPersistedAudioRecords(): Promise<AudioRecord[]> {
  const records: AudioRecord[] = [];

  // Try loading from IndexedDB
  try {
    const db = await openDB();
    const idbRecords = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (idbRecords && idbRecords.length > 0) {
      for (const item of idbRecords) {
        let playableUrl = item.dataUrl || item.blobUrl;
        if (item.dataUrl && item.dataUrl.startsWith('data:')) {
          try {
            const blob = dataUrlToBlob(item.dataUrl);
            playableUrl = URL.createObjectURL(blob);
          } catch (e) {
            playableUrl = item.dataUrl;
          }
        }
        records.push({
          id: item.id,
          name: item.name,
          blobUrl: playableUrl,
          durationSec: item.durationSec || 0,
          timestamp: item.timestamp || new Date().toLocaleString(),
          sizeStr: item.sizeStr || '0 KB'
        });
      }
      return records.reverse(); // Latest first
    }
  } catch (idbErr) {
    console.warn('IndexedDB read failed, trying LocalStorage fallback:', idbErr);
  }

  // Fallback to LocalStorage
  try {
    const lsData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lsData) {
      const parsed = JSON.parse(lsData);
      for (const item of parsed) {
        let playableUrl = item.dataUrl || item.blobUrl;
        if (item.dataUrl && item.dataUrl.startsWith('data:')) {
          try {
            const blob = dataUrlToBlob(item.dataUrl);
            playableUrl = URL.createObjectURL(blob);
          } catch (e) {
            playableUrl = item.dataUrl;
          }
        }
        records.push({
          id: item.id,
          name: item.name,
          blobUrl: playableUrl,
          durationSec: item.durationSec || 0,
          timestamp: item.timestamp || new Date().toLocaleString(),
          sizeStr: item.sizeStr || '0 KB'
        });
      }
    }
  } catch (lsErr) {
    console.warn('LocalStorage fallback failed:', lsErr);
  }

  return records;
}

export async function removePersistedAudioRecord(id: string): Promise<void> {
  // Remove from IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to delete from IndexedDB:', e);
  }

  // Remove from LocalStorage
  try {
    const lsData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lsData) {
      const parsed = JSON.parse(lsData);
      const filtered = parsed.filter((item: any) => item.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Failed to delete from LocalStorage:', e);
  }
}
