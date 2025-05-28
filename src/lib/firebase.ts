
// IMPORTANT: User must populate this file with their Firebase project configuration.

import { initializeApp, getApps, type FirebaseApp, getApp } from 'firebase/app';
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
  console.log("Firebase lib: Attempting initialization. Number of initialized apps before current init:", getApps().length);
  console.log("Firebase lib: Using firebaseConfig:", JSON.parse(JSON.stringify(firebaseConfig)));

  if (getApps().length === 0) {
    console.log("Firebase lib: Initializing new Firebase app.");
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); // Use the already initialized default app
    console.log("Firebase lib: Using existing Firebase app. Name:", app.name);
    // Defensive check: ensure existing app has correct config if possible, though usually getApp() returns the one init with config.
    if (app.options.apiKey !== firebaseConfig.apiKey) {
        console.warn("Firebase lib: Existing app's API key does not match provided firebaseConfig. This might lead to issues if multiple configs are used.");
    }
  }
  
  if (app) {
    console.log("Firebase lib: App object initialized/retrieved. App options:", JSON.parse(JSON.stringify(app.options)));
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
    console.log("Firebase lib: Firebase Auth and Firestore services obtained. Initialization successful.");
  } else {
    firebaseInitializationError = new Error("Firebase app object is null after initialization attempt.");
    console.error("Firebase lib: Critical error - Firebase app object is null after initialization attempt.");
    // firebaseInitialized remains false
  }

} catch (error) {
  console.error("Firebase lib: Initialization failed:", error);
  firebaseInitializationError = error instanceof Error ? error : new Error(String(error));
  // app, auth, db will remain null
  // firebaseInitialized remains false
}

export { app, auth, db, firebaseInitialized, firebaseInitializationError };
