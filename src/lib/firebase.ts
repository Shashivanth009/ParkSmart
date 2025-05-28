
// IMPORTANT: User must populate this file with their Firebase project configuration.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// THIS CONFIGURATION WAS PROVIDED BY THE USER
const firebaseConfig = {
  apiKey: "AIzaSyCY56IeVniiID4OfD0nRh2xQNPtoAZxMvo",
  authDomain: "parksmart-q73kd.firebaseapp.com",
  projectId: "parksmart-q73kd",
  storageBucket: "parksmart-q73kd.firebasestorage.app",
  messagingSenderId: "825624994828",
  appId: "1:825624994828:web:c0d88f84da6078023f7a29"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let firebaseInitialized = false;
let firebaseInitializationError: Error | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  if (app) {
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
  } else {
    throw new Error("Firebase app object is null after initialization attempt.");
  }

} catch (error) {
  console.error("Firebase initialization failed:", error);
  firebaseInitializationError = error instanceof Error ? error : new Error(String(error));
  // app, auth, db will remain null
}

export { app, auth, db, firebaseInitialized, firebaseInitializationError };
