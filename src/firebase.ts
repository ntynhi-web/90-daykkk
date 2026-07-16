import { initializeApp, getApps } from "firebase/app";
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  Firestore,
  doc,
  getDoc,
  initializeFirestore,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { AppState } from "./types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured
  ? (getApps()[0] || initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const db: Firestore | null = app
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : null;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const observeAuth = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
};

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase chưa được cấu hình.");
  return signInWithPopup(auth, googleProvider);
};

export const signOutCurrentUser = async () => {
  if (auth) await signOut(auth);
};

const stateDocument = (uid: string) => {
  if (!db) throw new Error("Firestore chưa được cấu hình.");
  return doc(db, "users", uid, "app", "state");
};

export const loadUserState = async (uid: string): Promise<AppState | null> => {
  const snapshot = await getDoc(stateDocument(uid));
  if (!snapshot.exists()) return null;
  return (snapshot.data().state || null) as AppState | null;
};

export const saveUserState = async (uid: string, state: AppState) => {
  await setDoc(stateDocument(uid), {
    state,
    updatedAt: serverTimestamp(),
    schemaVersion: 1
  }, { merge: true });
};

export type { User };
