import { createInitialWorldProgress, createNewHero } from './content.ts';
import type { SaveProfile } from './types.ts';

const DB_NAME = 'CryptboundOfflineDB';
const STORE_NAME = 'saves';
const SAVE_KEY = 'primary_profile_v1';
const LS_FALLBACK_KEY = 'cryptbound_save_v1';

function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProfileOffline(profile: SaveProfile): Promise<void> {
  const payload: SaveProfile = { ...profile, updatedAt: Date.now() };
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota fallback
  }
  try {
    const db = await openSaveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(payload, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB fallback handled by localStorage
  }
}

export async function loadProfileOffline(): Promise<SaveProfile | null> {
  try {
    const db = await openSaveDb();
    const found = await new Promise<SaveProfile | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SAVE_KEY);
      req.onsuccess = () => resolve(req.result as SaveProfile | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (found && found.version === 1) return found;
  } catch {
    // try localStorage
  }

  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveProfile;
      if (parsed && parsed.version === 1) return parsed;
    }
  } catch {
    // ignore corrupt save
  }
  return null;
}

export async function clearProfileOffline(): Promise<void> {
  try {
    localStorage.removeItem(LS_FALLBACK_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openSaveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export function createFreshSaveProfile(
  classId: 'warden' | 'stalker' | 'arcanist',
  name: string
): SaveProfile {
  return {
    version: 1,
    updatedAt: Date.now(),
    hero: createNewHero(classId, name),
    worldProgress: createInitialWorldProgress(),
    stash: [],
    bestiary: {},
    activeRun: null,
    settings: {
      muted: false,
      showDpad: true,
      tapToMove: true,
    },
  };
}

export function exportSaveAsJson(profile: SaveProfile) {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cryptbound-save-${profile.hero.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
