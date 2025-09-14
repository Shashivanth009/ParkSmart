// IMPORTANT: User must populate this file with their Firebase project configuration.

import { initializeApp, getApps, type FirebaseApp, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration is now loaded from environment variables
// to ensure security and flexibility in different environments (dev, prod).
// You must set these variables in a .env.local file for local development
// and in your deployment provider's settings (e.g., Netlify, Vercel).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let firebaseInitialized = false;
let firebaseInitializationError: Error | null = null;

try {
  // Check if all required environment variables are present
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Missing Firebase configuration. Please set NEXT_PUBLIC_FIREBASE_... variables in your environment.');
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); 
  }
  
  if (app) {
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
  } else {
    firebaseInitializationError = new Error("Firebase app object is null after initialization attempt.");
  }

} catch (error) {
  console.error("Firebase lib: Initialization failed:", error);
  firebaseInitializationError = error instanceof Error ? error : new Error(String(error));
}

export { app, auth, db, firebaseInitialized, firebaseInitializationError };
