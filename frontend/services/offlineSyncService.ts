import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface EventronDB extends DBSchema {
  cache: {
    key: string;
    value: any;
  };
  syncQueue: {
    key: number;
    value: {
      id?: number;
      action: string;
      collection: string;
      body: any;
      timestamp: number;
    };
    indexes: { 'timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<EventronDB>> | null = null;

export const initOfflineDB = () => {
  if (typeof window === 'undefined') return;
  if (!dbPromise) {
    dbPromise = openDB<EventronDB>('eventron-offline-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }
};

export const saveToCache = async (key: string, data: any) => {
  if (!dbPromise) initOfflineDB();
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('cache', data, key);
};

export const getFromCache = async (key: string) => {
  if (!dbPromise) initOfflineDB();
  if (!dbPromise) return null;
  const db = await dbPromise;
  return await db.get('cache', key);
};

export const enqueueSyncAction = async (action: string, collection: string, body: any) => {
  if (!dbPromise) initOfflineDB();
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.add('syncQueue', {
    action,
    collection,
    body,
    timestamp: Date.now(),
  });
  console.log(`[Offline Sync] Enqueued action: ${action} on ${collection}`);
};

export const getSyncQueue = async () => {
  if (!dbPromise) initOfflineDB();
  if (!dbPromise) return [];
  const db = await dbPromise;
  return await db.getAllFromIndex('syncQueue', 'timestamp');
};

export const removeSyncAction = async (id: number) => {
  if (!dbPromise) initOfflineDB();
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete('syncQueue', id);
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

// Simple state listener for React components to know online status
type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    listeners.forEach(cb => cb(true));
  });
  window.addEventListener('offline', () => {
    listeners.forEach(cb => cb(false));
  });
}

export const subscribeToOnlineStatus = (cb: Listener) => {
  listeners.add(cb);
  cb(isOnline());
  return () => listeners.delete(cb);
};
