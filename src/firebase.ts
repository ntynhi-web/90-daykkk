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
  writeBatch
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

const statePartDocument = (uid: string, part: "schedule" | "activity" | "records") => {
  if (!db) throw new Error("Firestore chưa được cấu hình.");
  return doc(db, "users", uid, "app", `state-${part}`);
};

export const loadUserState = async (uid: string): Promise<AppState | null> => {
  const snapshot = await getDoc(stateDocument(uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (!data.partitioned) return (data.state || null) as AppState | null;
  const [schedule, activity, records] = await Promise.all([
    getDoc(statePartDocument(uid, "schedule")),
    getDoc(statePartDocument(uid, "activity")),
    getDoc(statePartDocument(uid, "records"))
  ]);
  const scheduleData = schedule.exists() ? schedule.data() : {};
  const activityData = activity.exists() ? activity.data() : {};
  const recordData = records.exists() ? records.data() : {};
  return {
    ...(data.state || {}),
    scheduleItems: scheduleData.scheduleItems || [],
    activities: activityData.activities || [],
    routineLogs: activityData.routineLogs || [],
    milestoneProgressLogs: activityData.milestoneProgressLogs || [],
    weeklyReviews: activityData.weeklyReviews || [],
    healthRecords: recordData.healthRecords || {},
    lifestyleRecords: recordData.lifestyleRecords || {},
    b2bLeads: recordData.b2bLeads || [],
    jobApplications: recordData.jobApplications || [],
    batchTestRecords: recordData.batchTestRecords || [],
    aiChangeHistory: recordData.aiChangeHistory || [],
    coachHistory: recordData.coachHistory || [],
    experiments: recordData.experiments || []
  } as AppState;
};

export const saveUserState = async (uid: string, state: AppState) => {
  const {
    scheduleItems,
    activities,
    routineLogs,
    milestoneProgressLogs,
    weeklyReviews,
    healthRecords,
    lifestyleRecords,
    b2bLeads,
    jobApplications,
    batchTestRecords,
    aiChangeHistory,
    coachHistory,
    experiments,
    ...coreState
  } = state;
  if (!db) throw new Error("Firestore chưa được cấu hình.");
  const batch = writeBatch(db);
  batch.set(statePartDocument(uid, "schedule"), { scheduleItems: scheduleItems || [], updatedAt: serverTimestamp() });
  batch.set(statePartDocument(uid, "activity"), { activities: activities || [], routineLogs: routineLogs || [], milestoneProgressLogs: milestoneProgressLogs || [], weeklyReviews: weeklyReviews || [], updatedAt: serverTimestamp() });
  batch.set(statePartDocument(uid, "records"), { healthRecords: healthRecords || {}, lifestyleRecords: lifestyleRecords || {}, b2bLeads: b2bLeads || [], jobApplications: jobApplications || [], batchTestRecords: batchTestRecords || [], aiChangeHistory: aiChangeHistory || [], coachHistory: coachHistory || [], experiments: experiments || [], updatedAt: serverTimestamp() });
  batch.set(stateDocument(uid), {
    state: coreState,
    updatedAt: serverTimestamp(),
    schemaVersion: 2,
    partitioned: true
  });
  await batch.commit();
};

export type { User };
