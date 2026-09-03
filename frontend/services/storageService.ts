import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  ApplicationVerifier
} from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, getDoc, setDoc, limit
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, googleProvider } from "../firebaseConfig";
import { Event, Registration, RegistrationStatus, EventStatus, User, Team, ParticipationMode } from '../types';
import { STORAGE_KEYS } from '../constants';

const MONGO_CONFIG = {
  endpoint: '/api/action',
  apiKey: 'dummy',
  dataSource: 'Cluster0',
  database: 'event_horizon',
};

const USE_MONGO = true;
const USE_FIREBASE_STORAGE = isFirebaseConfigured && !USE_MONGO;
const USE_FIREBASE_AUTH = isFirebaseConfigured;
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'EventHorizon2026SecureKey32Bytes';

if (!import.meta.env.VITE_ENCRYPTION_KEY) {
  console.warn('⚠️ VITE_ENCRYPTION_KEY not set in .env - using fallback (NOT SECURE FOR PRODUCTION)');
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure HTTP contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

async function decryptData(encryptedResponse: any): Promise<any> {
  if (!encryptedResponse.encrypted) {
    return encryptedResponse;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const iv = Uint8Array.from(atob(encryptedResponse.iv), c => c.charCodeAt(0));
    const authTag = Uint8Array.from(atob(encryptedResponse.authTag), c => c.charCodeAt(0));
    const encryptedData = Uint8Array.from(atob(encryptedResponse.data), c => c.charCodeAt(0));

    const combined = new Uint8Array(encryptedData.length + authTag.length);
    combined.set(encryptedData);
    combined.set(authTag, encryptedData.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined
    );

    const jsonStr = new TextDecoder().decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedResponse;
  }
}


interface UserContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

async function mongoRequest(action: string, collection: string, body: any, retries = 3, userContext?: UserContext): Promise<any> {
  if (!MONGO_CONFIG.endpoint) return null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (userContext?.userId) {
      headers['X-User-Id'] = userContext.userId;
    }
    if (userContext?.userEmail) {
      headers['X-User-Email'] = userContext.userEmail;
    }
    if (userContext?.userRole) {
      headers['X-User-Role'] = userContext.userRole;
    }

    const response = await fetch(`${MONGO_CONFIG.endpoint}/${action}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        collection: collection,
        ...body
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("MongoDB API Error:", response.status, response.statusText, errorText);
      throw new Error(`MongoDB API Error: ${response.statusText} - ${errorText}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.encrypted) {
      return await decryptData(jsonResponse);
    }

    return jsonResponse;
  } catch (error) {
    if (retries > 0) {
      console.log(`Fetch failed, retrying... (${retries} left)`);
      await new Promise(res => setTimeout(res, 1000));
      return mongoRequest(action, collection, body, retries - 1, userContext);
    }
    throw error;
  }
}

export const getVectorRecommendations = async (userId: string): Promise<Event[]> => {
  if (!USE_MONGO) return [];
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!response.ok) throw new Error("Failed to fetch recommendations");
    const data = await response.json();
    return (data.recommendations || []).map((e: any) => ({ ...e, id: e.id || e._id }));
  } catch (error) {
    console.error("Vector Recommendation Error:", error);
    return [];
  }
};

export const getAdminData = async (userId: string, userEmail: string, userRole: string) => {
  if (!USE_MONGO) return { users: [], events: [], registrations: [] };

  try {
    const requests = [
      { collection: 'users', action: 'find', filter: {} },
      { collection: 'events', action: 'find', filter: {} },
      { collection: 'registrations', action: 'find', filter: {} }
    ];

    const userContext: UserContext = { userId, userEmail, userRole };
    const response = await mongoRequest('fetchBatch', '', { requests }, 3, userContext);

    return {
      users: (response.results[0]?.documents || []).map((u: any) => ({ ...u, id: u.id || u._id })),
      events: (response.results[1]?.documents || []).map((e: any) => ({ ...e, id: e.id || e._id })),
      registrations: (response.results[2]?.documents || []).map((r: any) => ({ ...r, id: r.id || r._id }))
    };
  } catch (e) {
    console.error("Admin Data Fetch Failed", e);
    return { users: [], events: [], registrations: [] };
  }
};

export const getInitialData = async (userId?: string, userEmail?: string, userRole?: string) => {
  if (USE_MONGO) {
    try {
      const requests = [

        {
          collection: 'events',
          action: 'find',
          filter: {},
          limit: 500,
          projection: { imageUrl: 0, description: 0 },
          sort: { date: -1 }
        },
        {
          collection: 'registrations',
          action: 'find',
          filter: {},
        },
        {
          collection: 'notifications',
          action: 'find',
          filter: { userId: userId || "" },
          sort: { createdAt: -1 }
        },
        {
          collection: 'teams',
          action: 'find',
          filter: {},
          sort: { createdAt: -1 }
        }
      ];

      const userContext: UserContext = { userId, userEmail, userRole };
      const response = await mongoRequest('fetchBatch', '', { requests }, 3, userContext);

      if (response && response.results) {
        const events = (response.results[0]?.documents || []).map((doc: any) => ({
          ...doc,
          id: doc.id || doc._id,
          imageUrl: '',
          description: doc.description || ''
        }));

        const registrations = (response.results[1]?.documents || []).map((doc: any) => ({
          ...doc,
          id: doc.id || doc._id
        }));

        const notifications = (response.results[2]?.documents || []).map((doc: any) => ({
          ...doc,
          id: doc.id || doc._id
        }));

        const teams = (response.results[3]?.documents || []).map((doc: any) => ({
          ...doc,
          id: doc.id || doc._id
        }));

        return { events, registrations, notifications, teams };
      }
    } catch (e) {
      console.error("Batch fetch failed", e);
    }
  }
  const [events, registrations] = await Promise.all([
    getEvents(),
    getRegistrations()
  ]);
  return { events, registrations, notifications: [], teams: [] };
};


export const getEvents = async (): Promise<Event[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'events', {
        filter: {},
        limit: 12,
        projection: { imageUrl: 0, description: 0 }
      });
      return result.documents.map((doc: any) => ({
        ...doc,
        id: doc.id || doc._id,
        imageUrl: '',
        description: doc.description || ''
      }));
    } catch (e) {
      console.error("Mongo fetch events failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const querySnapshot = await getDocs(query(collection(db, "events"), limit(50)));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (e) {
      console.error("Firebase getEvents failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
  return stored ? JSON.parse(stored) : [];
};

export const getEventImage = async (id: string): Promise<string | null> => {
  if (USE_MONGO) {
    // We now use the dedicated high-speed binary endpoint which is cached on the server
    return `/api/event-image/${id}`;
  }
  return null;
};

const eventCache: Record<string, Event> = {};

export const getEventById = async (id: string, options?: { excludeImage?: boolean }): Promise<Event | null> => {
  if (USE_MONGO) {
    if (eventCache[id] && !options?.excludeImage) {
      return eventCache[id];
    }

    try {
      const projection = options?.excludeImage ? { imageUrl: 0 } : {};
      const result = await mongoRequest('findOne', 'events', {
        filter: { id: id },
        projection: projection
      });

      const evt = result.document ? { ...result.document, id: result.document.id || result.document._id } : null;

      if (evt && !options?.excludeImage) {
        eventCache[id] = evt;
      }
      return evt;
    } catch (e) {
      console.error("Mongo fetch event details failed", e);
      return null;
    }
  }
  if (USE_FIREBASE_STORAGE) {
    const snap = await getDoc(doc(db, "events", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Event) : null;
  }

  const events = await getEvents();
  return events.find(e => e.id === id) || null;
};

export const saveEvent = async (event: Omit<Event, 'id'>): Promise<Event | null> => {
  const newId = generateUUID();
  const eventWithStatus = { ...event, status: EventStatus.PENDING };

  if (USE_MONGO) {
    try {
      const newEvent = { ...eventWithStatus, id: newId };
      await mongoRequest('insertOne', 'events', { document: newEvent });
      return newEvent;
    } catch (e: any) {
      console.error("Mongo save event failed", e);
      throw e;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const docRef = await addDoc(collection(db, "events"), eventWithStatus);
      return { ...eventWithStatus, id: docRef.id } as Event;
    } catch (e) {
      console.error("Firebase saveEvent failed:", e);
      return null;
    }
  }

  const newEvent = { ...eventWithStatus, id: newId };
  const events = await getEvents();
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([...events, newEvent]));
  return newEvent;
};

export const updateEventStatus = async (eventId: string, status: EventStatus): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('updateOne', 'events', {
        filter: { id: eventId },
        update: { $set: { status: status } }
      });
      return result.modifiedCount > 0 || result.matchedCount > 0;
    } catch (e) {
      console.error("Mongo update event status failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(collection(db, "events"), where("id", "==", eventId));
      const snap = await getDocs(q);
      if (snap.empty) return false;
      await updateDoc(doc(db, "events", snap.docs[0].id), { status: status });
      return true;
    } catch (e) {
      console.error("Firebase updateEventStatus failed:", e);
      return false;
    }
  }

  const events = await getEvents();
  const updated = events.map(e => e.id === eventId ? { ...e, status } : e);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updated));
  return true;
};
export const updateEvent = async (event: Event): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      // Get old event to check capacity increase
      const oldEventResult = await mongoRequest('findOne', 'events', { filter: { id: event.id } });
      const oldEvent = oldEventResult.document;
      const oldCapacity = oldEvent ? Number(oldEvent.capacity) : 0;
      const newCapacity = Number(event.capacity);

      const { id, _id, ...updateData } = event as any;
      const result = await mongoRequest('updateOne', 'events', {
        filter: { id: id },
        update: { $set: updateData }
      });

      const success = result.modifiedCount > 0 || result.matchedCount > 0 || result.upsertedCount > 0;

      // Handle Waitlist Promotion if capacity increased
      if (success && newCapacity > oldCapacity) {
        const regsResult = await mongoRequest('find', 'registrations', {
          filter: { eventId: id, status: { $ne: RegistrationStatus.REJECTED } }
        });

        const allRegs = regsResult.documents || [];
        const nonWaitlistedCount = allRegs.filter((r: any) => r.status !== RegistrationStatus.WAITLISTED).length;
        const waitlistedOnes = allRegs
          .filter((r: any) => r.status === RegistrationStatus.WAITLISTED)
          .sort((a: any, b: any) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

        const availableSlots = newCapacity - nonWaitlistedCount;
        if (availableSlots > 0 && waitlistedOnes.length > 0) {
          const toPromote = waitlistedOnes.slice(0, availableSlots);
          for (const reg of toPromote) {
            await mongoRequest('updateOne', 'registrations', {
              filter: { id: reg.id || reg._id },
              update: { $set: { status: RegistrationStatus.PENDING } }
            });
            console.log(`Auto-promoted ${reg.participantName} to PENDING`);
          }
        }
      }

      return success;
    } catch (e: any) {
      console.error("Mongo update event failed", e);
      throw e;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const eventRef = doc(db, "events", event.id);
      const oldEventSnap = await getDoc(eventRef);
      const oldCapacity = oldEventSnap.exists() ? Number(oldEventSnap.data().capacity) : 0;
      const newCapacity = Number(event.capacity);

      const { id, ...data } = event;
      await updateDoc(eventRef, data as any);

      if (newCapacity > oldCapacity) {
        const q = query(
          collection(db, "registrations"),
          where("eventId", "==", event.id),
          where("status", "!=", RegistrationStatus.REJECTED)
        );
        const snapshot = await getDocs(q);
        const allRegs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Registration));

        const nonWaitlistedCount = allRegs.filter(r => r.status !== RegistrationStatus.WAITLISTED).length;
        const waitlistedOnes = allRegs
          .filter(r => r.status === RegistrationStatus.WAITLISTED)
          .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

        const availableSlots = newCapacity - nonWaitlistedCount;
        if (availableSlots > 0 && waitlistedOnes.length > 0) {
          const toPromote = waitlistedOnes.slice(0, availableSlots);
          for (const reg of toPromote) {
            await updateDoc(doc(db, "registrations", reg.id), { status: RegistrationStatus.PENDING });
          }
        }
      }
      return true;
    } catch (e) {
      console.error("Firebase updateEvent failed:", e);
      return false;
    }
  }

  // Local Storage
  const events = await getEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    const oldCapacity = Number(events[index].capacity);
    const newCapacity = Number(event.capacity);
    events[index] = event;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

    if (newCapacity > oldCapacity) {
      const regs = await getRegistrations();
      const eventRegs = regs.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED);
      const nonWaitlisted = eventRegs.filter(r => r.status !== RegistrationStatus.WAITLISTED).length;
      const waitlisted = eventRegs
        .filter(r => r.status === RegistrationStatus.WAITLISTED)
        .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

      const available = newCapacity - nonWaitlisted;
      if (available > 0 && waitlisted.length > 0) {
        const toPromote = waitlisted.slice(0, available);
        toPromote.forEach(r => {
          const regIdx = regs.findIndex(found => found.id === r.id);
          if (regIdx >= 0) regs[regIdx].status = RegistrationStatus.PENDING;
        });
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(regs));
      }
    }
    return true;
  }
  return false;
};

export const deleteEvent = async (id: string): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      console.log(`[Delete Event] Attempting to delete event: ${id}`);
      const result = await mongoRequest('deleteOne', 'events', { filter: { id: id } });
      console.log("[Delete Event] DeleteOne result:", result);

      // Also delete registrations for this event to keep data clean
      try {
        await mongoRequest('deleteMany', 'registrations', { filter: { eventId: id } });
      } catch (regError) {
        console.warn("[Delete Event] Failed to cleanup registrations:", regError);
        // We still consider the event deletion a success if the event itself was removed
      }

      return true; // We return true if the request completed without error
    } catch (e) {
      console.error("Mongo delete event failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await deleteDoc(doc(db, "events", id));
      // Note: In Firestore, you'd typically need a cloud function or batch to delete sub-collections/related docs
      return true;
    } catch (e) {
      console.error("Firebase deleteEvent failed:", e);
      return false;
    }
  }

  // Local Storage
  const events = await getEvents();
  const filteredEvents = events.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filteredEvents));

  const regs = await getRegistrations();
  const filteredRegs = regs.filter(r => r.eventId !== id);
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(filteredRegs));

  return true;
};

// --- Registrations ---

export const getRegistrations = async (): Promise<Registration[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'registrations', { filter: {} });
      return result.documents.map((doc: any) => ({ ...doc, id: doc.id || doc._id }));
    } catch (e) {
      console.error("Mongo fetch registrations failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const querySnapshot = await getDocs(collection(db, "registrations"));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
    } catch (e) {
      console.error("Firebase getRegistrations failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
  return stored ? JSON.parse(stored) : [];
};

export const addRegistration = async (reg: Omit<Registration, 'id'>): Promise<Registration | null> => {
  const newId = generateUUID();

  if (USE_MONGO) {
    try {
      // Validation: Check Capacity
      // This is a rough check; ideally should be atomic transaction or use $inc with condition
      const eventResult = await mongoRequest('findOne', 'events', { filter: { id: reg.eventId } });
      const event = eventResult.document;

      if (!event) throw new Error("Event not found");

      const regsResult = await mongoRequest('find', 'registrations', {
        filter: { eventId: reg.eventId, status: { $ne: RegistrationStatus.REJECTED } }
      });
      const count = regsResult.documents.length;

      const isFull = count >= Number(event.capacity || 0);
      const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      const newReg = { ...reg, id: newId, status: status };
      await mongoRequest('insertOne', 'registrations', { document: newReg });
      return newReg;
    } catch (e) {
      console.error("Mongo add registration failed", e);
      return null;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      // Simple Capacity Check for Firebase
      // Note: Ideally use transactions for concurrency safety
      const eventDoc = await getDoc(doc(db, "events", reg.eventId));
      if (!eventDoc.exists()) return null;

      const eventData = eventDoc.data() as Event;
      const q = query(
        collection(db, "registrations"),
        where("eventId", "==", reg.eventId),
        where("status", "!=", RegistrationStatus.REJECTED)
      );
      const snapshot = await getDocs(q);

      const isFull = snapshot.size >= eventData.capacity;
      const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      const newRegData = { ...reg, status: status };
      const docRef = await addDoc(collection(db, "registrations"), newRegData);
      return { ...newRegData, id: docRef.id } as Registration;
    } catch (e) {
      console.error("Firebase addRegistration failed:", e);
      return null;
    }
  }

  // Local Storage Fallback
  const events = await getEvents();
  const event = events.find(e => e.id === reg.eventId);

  if (!event) {
    console.error("Event not found");
    return null;
  }

  const regs = await getRegistrations();
  const eventRegs = regs.filter(r => r.eventId === reg.eventId && r.status !== RegistrationStatus.REJECTED);

  const isFull = eventRegs.length >= event.capacity;
  const status = isFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

  const newReg = { ...reg, id: newId, status: status };
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([...regs, newReg]));
  return newReg;
};

export const deleteRegistration = async (id: string): Promise<boolean> => {
  let eventIdToCleanup: string | null = null;

  if (USE_MONGO) {
    try {
      const regResult = await mongoRequest('findOne', 'registrations', { filter: { id: id } });
      if (regResult.document) {
        eventIdToCleanup = regResult.document.eventId;
      }

      const result = await mongoRequest('deleteOne', 'registrations', { filter: { id: id } });
      console.log("Delete result:", result);

      if (result.deletedCount > 0 && eventIdToCleanup) {
        // Promote next person from waitlist
        const waitlisted = await mongoRequest('find', 'registrations', {
          filter: { eventId: eventIdToCleanup, status: RegistrationStatus.WAITLISTED },
          sort: { registeredAt: 1 },
          limit: 1
        });

        if (waitlisted.documents && waitlisted.documents.length > 0) {
          const nextInLine = waitlisted.documents[0];
          await mongoRequest('updateOne', 'registrations', {
            filter: { id: nextInLine.id || nextInLine._id },
            update: { $set: { status: RegistrationStatus.PENDING } }
          });
        }
      }
      return result.deletedCount > 0;
    } catch (e) {
      console.error("Mongo delete registration failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regSnap = await getDoc(doc(db, "registrations", id));
      if (regSnap.exists()) {
        eventIdToCleanup = (regSnap.data() as Registration).eventId;
      }

      await deleteDoc(doc(db, "registrations", id));

      if (eventIdToCleanup) {
        const q = query(
          collection(db, "registrations"),
          where("eventId", "==", eventIdToCleanup),
          where("status", "==", RegistrationStatus.WAITLISTED)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Find oldest one manually since Firestore query sort can be tricky with composite indexes
          const waitlistedDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Registration));
          waitlistedDocs.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

          const nextInLine = waitlistedDocs[0];
          await updateDoc(doc(db, "registrations", nextInLine.id), { status: RegistrationStatus.PENDING });
        }
      }
      return true;
    } catch (e) {
      console.error("Firebase deleteRegistration failed:", e);
      return false;
    }
  }

  const regs = await getRegistrations();
  const regToDelete = regs.find(r => r.id === id);
  if (regToDelete) eventIdToCleanup = regToDelete.eventId;

  const filtered = regs.filter(r => r.id !== id);

  if (eventIdToCleanup) {
    const waitlistedIndex = filtered.findIndex(r => r.eventId === eventIdToCleanup && r.status === RegistrationStatus.WAITLISTED);
    if (waitlistedIndex !== -1) {
      filtered[waitlistedIndex].status = RegistrationStatus.PENDING;
    }
  }

  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(filtered));
  return true;
};

export const updateRegistrationStatus = async (id: string, status: RegistrationStatus, extraData?: Partial<Registration>): Promise<void> => {
  if (USE_MONGO) {
    try {
      await mongoRequest('updateOne', 'registrations', {
        filter: { id: id },
        update: { $set: { status: status, ...extraData } }
      });
      return;
    } catch (e) {
      console.error("Mongo update status failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regRef = doc(db, "registrations", id);
      await updateDoc(regRef, { status, ...extraData });
      return;
    } catch (e) {
      console.error("Firebase updateRegistrationStatus failed:", e);
    }
  }

  const regs = await getRegistrations();
  const updated = regs.map(r => r.id === id ? { ...r, status, ...extraData } : r);
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(updated));
};

export const markAttendance = async (id: string): Promise<boolean> => {
  const timestamp = new Date().toISOString();

  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'registrations', { filter: { id: id } });
      const reg = result.document;

      if (reg && reg.status === RegistrationStatus.APPROVED && !reg.attended) {
        await mongoRequest('updateOne', 'registrations', {
          filter: { id: id },
          update: { $set: { attended: true, attendanceTime: timestamp } }
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Mongo mark attendance failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const regRef = doc(db, "registrations", id);
      const regSnap = await getDoc(regRef);

      if (regSnap.exists()) {
        const reg = regSnap.data() as Registration;
        if (reg.status === RegistrationStatus.APPROVED && !reg.attended) {
          await updateDoc(regRef, { attended: true, attendanceTime: timestamp });
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Firebase markAttendance failed:", e);
      return false;
    }
  }

  const regs = await getRegistrations();
  let found = false;
  const updated = regs.map(r => {
    if (r.id === id) {
      if (r.status === RegistrationStatus.APPROVED && !r.attended) {
        found = true;
        return { ...r, attended: true, attendanceTime: timestamp };
      }
    }
    return r;
  });

  if (found) {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(updated));
  }
  return found;
};

// --- Teams ---

export const createTeam = async (team: Omit<Team, 'id'>): Promise<Team | null> => {
  const newId = generateUUID();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newTeam = { ...team, id: newId, inviteCode } as Team;

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'teams', { document: newTeam });
      return newTeam;
    } catch (e) {
      console.error("Mongo create team failed", e);
      return null;
    }
  }

  // Local fallback
  const stored = localStorage.getItem('teams') || '[]';
  const teams = JSON.parse(stored);
  teams.push(newTeam);
  localStorage.setItem('teams', JSON.stringify(teams));
  return newTeam;
};

export const getTeamByInviteCode = async (code: string): Promise<Team | null> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'teams', { filter: { inviteCode: code } });
      return result.document ? { ...result.document, id: result.document.id || result.document._id } : null;
    } catch (e) {
      console.error("Mongo get team by code failed", e);
      return null;
    }
  }
  return null;
};

export const getTeamById = async (id: string): Promise<Team | null> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('findOne', 'teams', { filter: { id: id } });
      return result.document ? { ...result.document, id: result.document.id || result.document._id } : null;
    } catch (e) {
      console.error("Mongo get team by id failed", e);
      return null;
    }
  }
  return null;
};

export const joinTeam = async (teamId: string, user: { userId: string, userName: string, email: string }): Promise<boolean> => {
  if (USE_MONGO) {
    try {
      const team = await getTeamById(teamId);
      if (!team) return false;

      // Check if user already in team
      if (team.members.some(m => m.userId === user.userId)) return true;

      const newMembers = [...team.members, user];
      await mongoRequest('updateOne', 'teams', {
        filter: { id: teamId },
        update: { $set: { members: newMembers } }
      });
      return true;
    } catch (e) {
      console.error("Mongo join team failed", e);
      return false;
    }
  }
  return false;
};

export const getTeamsByEventId = async (eventId: string): Promise<Team[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'teams', { filter: { eventId: eventId } });
      return result.documents.map((doc: any) => ({ ...doc, id: doc.id || doc._id }));
    } catch (e) {
      console.error("Mongo fetch teams failed", e);
      return [];
    }
  }
  return [];
};

// --- Auth & Users ---

// Retrieve user profile
export const getUserProfile = async (uid: string): Promise<User | null> => {
  if (USE_MONGO) {
    try {
      // Prioritize admins collection check
      let result = await mongoRequest('findOne', 'admins', { filter: { id: uid } });
      if (!result.document) {
        result = await mongoRequest('findOne', 'users', { filter: { id: uid } });
      }
      return result.document || null;
    } catch (e) {
      console.error("Mongo get user failed", e);
      return null;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (e) {
      console.error("Firebase getUserProfile failed:", e);
      return null;
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.USERS);
  const users: User[] = stored ? JSON.parse(stored) : [];
  return users.find(u => u.id === uid) || null;
};

// Save user profile
export const saveUserProfile = async (user: User): Promise<void> => {
  // Always update current user in local storage if this is the user currently logged in
  const storedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (storedCurrent) {
    const current = JSON.parse(storedCurrent);
    if (current.id === user.id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
  }

  if (USE_MONGO) {
    try {
      // Check if exists first to avoid duplicates if using simplistic insert
      const existing = await getUserProfile(user.id);
      const targetCollection = (existing?.role === 'admin' || user.role === 'admin') ? 'admins' : 'users';
      if (!existing) {
        const { _id, ...cleanUser } = user as any;
        await mongoRequest('insertOne', targetCollection, { document: cleanUser });
      } else {
        const { _id, ...updateData } = user as any;
        await mongoRequest('updateOne', targetCollection, {
          filter: { id: user.id },
          update: { $set: updateData }
        });
      }
      // Continue to local storage as fallback/redundancy
    } catch (e) {
      console.error("Mongo save user failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await setDoc(doc(db, "users", user.id), user);
    } catch (e) {
      console.error("Firebase saveUserProfile failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.USERS);
  const users: User[] = stored ? JSON.parse(stored) : [];
  // Update if exists, else add
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const registerUser = async (user: Omit<User, 'id'>, password: string): Promise<User | null> => {
  if (USE_FIREBASE_AUTH) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
      const uid = userCredential.user.uid;

      const userData: User = {
        ...user,
        id: uid
      };

      await saveUserProfile(userData);
      return userData;
    } catch (error) {
      console.error("Firebase Registration error:", error);
      return null;
    }
  }

  // Common Logic for Mongo or Local (No Auth Provider)

  // Check if email already exists
  let existingUser = null;
  if (USE_MONGO) {
    let result = await mongoRequest('findOne', 'admins', { filter: { email: user.email } });
    existingUser = result.document || null;
    if (!existingUser) {
      result = await mongoRequest('findOne', 'users', { filter: { email: user.email } });
      existingUser = result.document || null;
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    existingUser = users.find(u => u.email === user.email);
  }

  if (existingUser) return null;

  const newUser = { ...user, id: generateUUID(), password }; // Storing password for custom auth
  await saveUserProfile(newUser);

  // Auto-login for local/mongo mode persistence
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

  return newUser;
};

export const loginUser = async (email: string, password: string): Promise<User | null> => {
  if (USE_FIREBASE_AUTH) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(userCredential.user.uid);
      if (profile) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
      }
      return profile;
    } catch (error) {
      console.error("Firebase Login error:", error);
      return null;
    }
  }

  // Common Logic for Mongo or Local
  let user: User | null = null;

  if (USE_MONGO) {
    try {
      let result = await mongoRequest('findOne', 'admins', {
        filter: { email: email, password: password }
      });
      user = result.document || null;

      if (!user) {
        result = await mongoRequest('findOne', 'users', {
          filter: { email: email, password: password }
        });
        user = result.document || null;
      }
    } catch (e) {
      console.error("Mongo Login Error", e);
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    user = users.find(u => u.email === email && (u as any).password === password) || null;
  }

  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }
  return user;
};

// --- Phone Auth Helpers ---

export const initRecaptcha = (elementOrId: string | HTMLElement): ApplicationVerifier => {
  if (!USE_FIREBASE_AUTH) throw new Error("Firebase not configured");

  // Nuke any global state that might be stale
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Soft reset for stale verifier");
    }
    (window as any).recaptchaVerifier = null;
  }

  // Ensure the element is clean
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (el) {
    el.innerHTML = '';
  }

  try {
    const verifier = new RecaptchaVerifier(auth, elementOrId, {
      'size': 'invisible',
      'callback': () => {
        // Verification success
      },
      'expired-callback': () => {
        // Reset on expiry
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        }
      }
    });

    (window as any).recaptchaVerifier = verifier;
    return verifier;
  } catch (err: any) {
    console.error("Recaptcha Init Error:", err);
    // If it fails because of 'already rendered', we ignore and try to return global
    if (err.message?.includes('already rendered') && (window as any).recaptchaVerifier) {
      return (window as any).recaptchaVerifier;
    }
    throw err;
  }
}

export interface TwilioAuthStatus {
  isConfigured: boolean;
  isAvailable: boolean;
  status: 'active' | 'unconfigured' | 'trial_expired' | 'service_not_found' | 'error';
  message: string;
}

export const getTwilioAuthStatus = async (): Promise<TwilioAuthStatus> => {
  try {
    const response = await fetch('/api/auth/twilio/status');
    if (!response.ok) {
      return {
        isConfigured: false,
        isAvailable: false,
        status: 'error',
        message: 'Unable to check SMS service status'
      };
    }
    return await response.json();
  } catch {
    return {
      isConfigured: false,
      isAvailable: false,
      status: 'error',
      message: 'Network error checking SMS service status'
    };
  }
};

export const sendTwilioOtp = async (phoneNumber: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<{ success: boolean; status?: string; message?: string; channel?: string }> => {
  try {
    const response = await fetch('/api/auth/twilio/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, channel }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to send OTP via Twilio');
    }

    return data;
  } catch (error: any) {
    console.error("Twilio send OTP error:", error);
    throw error;
  }
};

export const verifyTwilioOtp = async (phoneNumber: string, otp: string): Promise<User | null> => {
  try {
    const response = await fetch('/api/auth/twilio/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, otp }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Invalid or expired OTP');
    }

    const user = data.user as User;
    if (user) {
      localStorage.setItem('eh_current_user', JSON.stringify(user));
    }
    return user;
  } catch (error: any) {
    console.error("Twilio verify OTP error:", error);
    throw error;
  }
};

export const signInWithPhone = async (phoneNumber: string, channel: 'sms' | 'whatsapp' = 'sms', appVerifier?: ApplicationVerifier): Promise<any> => {
  // Use Twilio SMS by default
  const res = await sendTwilioOtp(phoneNumber, channel);
  return { phoneNumber, ...res };
};



export const verifyPhoneOtp = async (confirmationResult: any, otp: string, fallbackPhone?: string): Promise<User | null> => {
  const phone = confirmationResult?.phoneNumber || fallbackPhone;
  if (phone) {
    return await verifyTwilioOtp(phone, otp);
  }
  if (confirmationResult && typeof confirmationResult.confirm === 'function') {
    const result = await confirmationResult.confirm(otp);
    const user = result.user;
    return await getUserProfile(user.uid);
  }
  throw new Error("Unable to verify OTP: missing phone number reference.");
};


export const loginWithGoogle = async (role: 'attendee' | 'organizer'): Promise<User | null> => {
  if (!USE_FIREBASE_AUTH) {
    alert("Firebase Auth is not configured.");
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    // Check if user profile already exists
    let userProfile = await getUserProfile(firebaseUser.uid);

    if (!userProfile) {
      // First time login - create profile
      userProfile = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        email: firebaseUser.email || '',
        role: role, // Role chosen by user in UI before clicking Google Sign In? Or we default?
        // We'll pass it in.
        password: '', // No password for OAuth
      };
      await saveUserProfile(userProfile);
    }

    return userProfile;
  } catch (error) {
    console.error("Google Sign In Error", error);
    return null;
  }
};

export const logoutUser = async (): Promise<void> => {
  if (USE_FIREBASE_AUTH) {
    await firebaseSignOut(auth);
  }

  // Clear local session regardless of mode
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (USE_FIREBASE_AUTH) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        if (userProfile) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userProfile));
          callback(userProfile);
        } else {
          // Check local storage as last resort
          const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          if (stored) {
            callback(JSON.parse(stored));
          } else {
            // Basic user info if no profile found yet
            callback({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: 'attendee'
            });
          }
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        callback(null);
      }
    });
  }

  // MongoDB or Local Storage Auth persistence
  const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      // Verify user still exists in "database" but be lenient if server is down
      getUserProfile(user.id).then(verified => {
        if (verified) {
          callback(verified);
        } else {
          // Only remove if we actually got a 'null' response from a WORKING server
          // (Wait, getUserProfile returns null on catch. We should distinguish between "not found" and "request failed")
          // For now, let's trust the local storage if the server is unreachable.
          callback(user);
        }
      }).catch(() => {
        // Server unreachable, trust local storage
        callback(user);
      });
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      callback(null);
    }
  } else {
    callback(null);
  }

  return () => { };
};

export const checkPhoneNumberExists = async (phoneNumber: string): Promise<boolean> => {
  const clean = phoneNumber.trim().replace(/\s+/g, '');
  const variations = Array.from(new Set([clean, clean.replace('+', ''), clean.slice(-10)]));

  if (USE_MONGO) {
    try {
      for (const v of variations) {
        let result = await mongoRequest('findOne', 'admins', { filter: { phoneNumber: v } });
        if (result && result.document) return true;
        result = await mongoRequest('findOne', 'users', { filter: { phoneNumber: v } });
        if (result && result.document) return true;
      }
      return false;
    } catch (e) {
      console.error("Mongo check phone failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      for (const v of variations) {
        const q = query(collection(db, "users"), where("phoneNumber", "==", v));
        const snap = await getDocs(q);
        if (!snap.empty) return true;
      }
    } catch (e) {
      console.error("Firebase check phone failed", e);
    }
    return false;
  }

  const stored = localStorage.getItem(STORAGE_KEYS.USERS);
  if (stored) {
    const users: User[] = JSON.parse(stored);
    return users.some(u => variations.includes((u.phoneNumber || '').trim().replace(/\s+/g, '')));
  }

  return false;
};


export const resetUserPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  if (USE_FIREBASE_AUTH) {
    console.log(`[Reset Password] Using Firebase Auth for ${email}.`);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("[Reset Password] Firebase sendPasswordResetEmail completed successfully.");
      return {
        success: true,
        message: "Link sent! If you don't see it, check Spam or verify you didn't sign up with Google."
      };
    } catch (error: any) {
      console.error("[Reset Password] Firebase Error:", error);
      let msg = "Failed to send reset email.";
      if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
      if (error.code === 'auth/invalid-email') msg = "Invalid email address.";
      return { success: false, message: msg };
    }
  }

  // Local/Mock Implementation
  console.log(`[Reset Password] Attempting reset for: ${email}`);

  let exists = false;
  if (USE_MONGO) {
    try {
      let result = await mongoRequest('findOne', 'admins', { filter: { email } });
      exists = !!result.document;
      if (!exists) {
        result = await mongoRequest('findOne', 'users', { filter: { email } });
        exists = !!result.document;
      }
      console.log("[Reset Password] Mongo Find Result:", result);
    } catch (e) {
      console.error("[Reset Password] Mongo Error:", e);
    }
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    exists = users.some(u => u.email === email);
    console.log("[Reset Password] Local Storage Check:", exists);
  }

  if (exists) {
    const resetLink = `http://localhost:3000/reset-password-demo?email=${encodeURIComponent(email)}&token=${generateUUID()}`;
    console.log(`%c[MOCK EMAIL] Password Reset Link: ${resetLink}`, "color: #4f46e5; font-weight: bold; font-size: 14px;");
    return { success: true, message: "DEMO MODE: Reset link logged to browser console (F12)." };
  }

  console.warn(`[Reset Password] User with email ${email} not found.`);
  return { success: false, message: `User ${email} not found (Demo Mode).` };
};

// --- Notifications ---

export const getNotifications = async (userId: string): Promise<any[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'notifications', { filter: { userId: userId } });
      return result.documents.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Mongo fetch notifications failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Firebase getNotifications failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  return notifications.filter((n: any) => n.userId === userId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addNotification = async (notification: Omit<any, 'id'>): Promise<void> => {
  const newId = generateUUID();
  const newNotification = { ...notification, id: newId, createdAt: new Date().toISOString(), read: false };

  // Trigger Push Notification
  try {
    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: notification.userId,
        title: notification.title,
        message: notification.message
      })
    }).catch(err => console.error("Push trigger failed silently", err));
  } catch (e) {
    // Ignore push errors to prevent blocking main logic
  }

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'notifications', { document: newNotification });
      return;
    } catch (e) {
      console.error("Mongo add notification failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await addDoc(collection(db, "notifications"), newNotification);
      return;
    } catch (e) {
      console.error("Firebase addNotification failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications', JSON.stringify([...notifications, newNotification]));
};

export const markNotificationRead = async (id: string): Promise<void> => {
  if (USE_MONGO) {
    try {
      await mongoRequest('updateOne', 'notifications', {
        filter: { id: id },
        update: { $set: { read: true } }
      });
      return;
    } catch (e) {
      console.error("Mongo mark notification read failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      return;
    } catch (e) {
      console.error("Firebase markNotificationRead failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  const updated = notifications.map((n: any) => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications', JSON.stringify(updated));
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  if (USE_MONGO) {
    try {
      await mongoRequest('updateMany', 'notifications', {
        filter: { userId: userId, read: false },
        update: { $set: { read: true } }
      });
      return;
    } catch (e) {
      console.error("Mongo mark all notifications read failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", false)
      );
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(doc => updateDoc(doc.ref, { read: true }));
      await Promise.all(updates);
      return;
    } catch (e) {
      console.error("Firebase markAllNotificationsRead failed:", e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications');
  const notifications = stored ? JSON.parse(stored) : [];
  const updated = notifications.map((n: any) => n.userId === userId ? { ...n, read: true } : n);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS || 'notifications', JSON.stringify(updated));
};

// --- Discussion Messages ---

export const getMessages = async (eventId: string): Promise<any[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'messages', { filter: { eventId: eventId } });
      return result.documents.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      console.error("Mongo fetch messages failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "messages"),
        where("eventId", "==", eventId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      console.error("Firebase getMessages failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem('eh_messages');
  const messages = stored ? JSON.parse(stored) : [];
  return messages.filter((m: any) => m.eventId === eventId).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const addMessage = async (message: Omit<any, 'id'>): Promise<void> => {
  const newId = generateUUID();
  const newMessage = { ...message, id: newId, createdAt: new Date().toISOString() };

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'messages', { document: newMessage });
      return;
    } catch (e) {
      console.error("Mongo add message failed", e);
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await addDoc(collection(db, "messages"), newMessage);
      return;
    } catch (e) {
      console.error("Firebase addMessage failed:", e);
    }
  }

  const stored = localStorage.getItem('eh_messages');
  const messages = stored ? JSON.parse(stored) : [];
  localStorage.setItem('eh_messages', JSON.stringify([...messages, newMessage]));
};

// --- Reviews ---

export const getReviews = async (eventId: string): Promise<any[]> => {
  if (USE_MONGO) {
    try {
      const result = await mongoRequest('find', 'reviews', { filter: { eventId: eventId } });
      return result.documents.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Mongo fetch reviews failed", e);
      return [];
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      const q = query(
        collection(db, "reviews"),
        where("eventId", "==", eventId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Firebase getReviews failed:", e);
      return [];
    }
  }

  const stored = localStorage.getItem('reviews');
  const reviews = stored ? JSON.parse(stored) : [];
  return reviews.filter((r: any) => r.eventId === eventId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addReview = async (review: Omit<any, 'id'>): Promise<void> => {
  const newId = generateUUID();
  const newReview = { ...review, id: newId, createdAt: new Date().toISOString() };

  if (USE_MONGO) {
    try {
      await mongoRequest('insertOne', 'reviews', { document: newReview });
      return;
    } catch (e) {
      console.error("Mongo add review failed", e);
      return;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      await addDoc(collection(db, "reviews"), newReview);
      return;
    } catch (e) {
      console.error("Firebase addReview failed:", e);
      return;
    }
  }

  const stored = localStorage.getItem('reviews');
  const reviews = stored ? JSON.parse(stored) : [];
  localStorage.setItem('reviews', JSON.stringify([...reviews, newReview]));
};

// --- Account Management ---

export const sendEmailDeleteOtp = async (email: string, userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch('/api/auth/email/send-delete-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to send verification code.');
    }
    return data;
  } catch (error: any) {
    console.error("sendEmailDeleteOtp error:", error);
    throw error;
  }
};

export const verifyEmailDeleteOtp = async (
  email: string,
  userId: string,
  otp: string,
  isOrganizer: boolean
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch('/api/auth/email/verify-delete-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId, otp, isOrganizer }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Invalid or expired verification code.');
    }

    // Clear local storage session
    localStorage.removeItem('eh_current_user');
    return data;
  } catch (error: any) {
    console.error("verifyEmailDeleteOtp error:", error);
    throw error;
  }
};

export const deleteAccount = async (userId: string, isOrganizer: boolean): Promise<boolean> => {
  console.log(`[Delete Account] Starting deletion for user: ${userId} (Organizer: ${isOrganizer})`);

  if (USE_MONGO) {
    try {
      // 1. Delete User Profile
      await mongoRequest('deleteOne', 'users', { filter: { id: userId } });
      await mongoRequest('deleteOne', 'admins', { filter: { id: userId } });

      // 2. Delete Registrations (as participant)
      await mongoRequest('deleteMany', 'registrations', { filter: { participantId: userId } });

      // 3. Delete Notifications
      await mongoRequest('deleteMany', 'notifications', { filter: { userId: userId } });

      // 4. Delete Messages (sent by user)
      await mongoRequest('deleteMany', 'messages', { filter: { userId: userId } });

      // 5. Delete Reviews (written by user)
      await mongoRequest('deleteMany', 'reviews', { filter: { userId: userId } });

      // 6. If Organizer: Delete Events and their related data
      if (isOrganizer) {
        // Find events first to delete their registrations
        const eventsResult = await mongoRequest('find', 'events', { filter: { organizerId: userId } });
        const events = eventsResult.documents || [];

        for (const event of events) {
          // Delete registrations for this event
          await mongoRequest('deleteMany', 'registrations', { filter: { eventId: event.id } });
          // Delete messages for this event
          await mongoRequest('deleteMany', 'messages', { filter: { eventId: event.id } });
          // Delete reviews for this event
          await mongoRequest('deleteMany', 'reviews', { filter: { eventId: event.id } });
          // Delete teams for this event
          await mongoRequest('deleteMany', 'teams', { filter: { eventId: event.id } });
        }

        // Finally delete the events
        await mongoRequest('deleteMany', 'events', { filter: { organizerId: userId } });
      }

      // 7. Delete from Firebase Auth (if currently signed in)
      const user = auth.currentUser;
      if (user && user.uid === userId) {
        await user.delete();
      }

      return true;
    } catch (e) {
      console.error("Mongo delete account failed", e);
      return false;
    }
  }

  if (USE_FIREBASE_STORAGE) {
    try {
      // Note: Firestore deletions are usually done via batch or cloud functions for this scale.
      // Doing simplified client-side deletion here.

      // 1. User Profile
      await deleteDoc(doc(db, "users", userId));

      // 2. Registrations
      const regQ = query(collection(db, "registrations"), where("participantId", "==", userId));
      const regSnap = await getDocs(regQ);
      regSnap.forEach(async (d) => await deleteDoc(d.ref));

      // 3. Notifications
      const notifQ = query(collection(db, "notifications"), where("userId", "==", userId));
      const notifSnap = await getDocs(notifQ);
      notifSnap.forEach(async (d) => await deleteDoc(d.ref));

      // 4. Messages
      const msgQ = query(collection(db, "messages"), where("userId", "==", userId));
      const msgSnap = await getDocs(msgQ);
      msgSnap.forEach(async (d) => await deleteDoc(d.ref));

      // 5. Reviews
      const reviewQ = query(collection(db, "reviews"), where("userId", "==", userId));
      const reviewSnap = await getDocs(reviewQ);
      reviewSnap.forEach(async (d) => await deleteDoc(d.ref));

      // 6. Organizer Data
      if (isOrganizer) {
        const eventQ = query(collection(db, "events"), where("organizerId", "==", userId));
        const eventSnap = await getDocs(eventQ);

        for (const eventDoc of eventSnap.docs) {
          const eventId = eventDoc.id;
          // Delete related regs
          const eRegQ = query(collection(db, "registrations"), where("eventId", "==", eventId));
          const eRegSnap = await getDocs(eRegQ);
          eRegSnap.forEach(async (d) => await deleteDoc(d.ref));

          // Delete messages
          const eMsgQ = query(collection(db, "messages"), where("eventId", "==", eventId));
          const eMsgSnap = await getDocs(eMsgQ);
          eMsgSnap.forEach(async (d) => await deleteDoc(d.ref));

          // Delete reviews
          const eRevQ = query(collection(db, "reviews"), where("eventId", "==", eventId));
          const eRevSnap = await getDocs(eRevQ);
          eRevSnap.forEach(async (d) => await deleteDoc(d.ref));

          // Delete teams
          const eTeamQ = query(collection(db, "teams"), where("eventId", "==", eventId));
          const eTeamSnap = await getDocs(eTeamQ);
          eTeamSnap.forEach(async (d) => await deleteDoc(d.ref));

          // Delete event
          await deleteDoc(eventDoc.ref);
        }
      }

      // 7. Auth
      const user = auth.currentUser;
      if (user && user.uid === userId) {
        await user.delete();
      }

      return true;
    } catch (e) {
      console.error("Firebase delete account failed", e);
      return false;
    }
  }

  // Local Storage
  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users.filter((u: any) => u.id !== userId)));

  const regs = JSON.parse(localStorage.getItem(STORAGE_KEYS.REGISTRATIONS) || '[]');
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(regs.filter((r: any) => r.participantId !== userId)));

  // ... cleanup other local storage keys similarly ...
  // For demo, we might just clear current user
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

  return true;
};