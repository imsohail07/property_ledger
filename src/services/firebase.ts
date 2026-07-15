import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory cache only (disables IndexedDB / LocalStorage offline cache)
const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Connect to Emulators in dev mode unless configured to connect to production
if (import.meta.env.DEV) {
  const useProduction = import.meta.env.VITE_USE_PRODUCTION_FIREBASE === "true";
  if (!useProduction) {
    try {
      connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "localhost", 8080);
      connectStorageEmulator(storage, "localhost", 9199);
      console.log("🔥 Connected to Firebase Emulators");
    } catch (e) {
      console.warn("Firebase emulators already connected or failed to connect:", e);
    }
  } else {
    console.log("🚀 Connected to Live Production Firebase");
  }
}

export { auth, db, storage, googleProvider };
export default app;
