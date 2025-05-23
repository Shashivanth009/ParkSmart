
// IMPORTANT: User must populate this file with their Firebase project configuration.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCY56IeVniiID4OfD0nRh2xQNPtoAZxMvo",
  authDomain: "parksmart-q73kd.firebaseapp.com",
  projectId: "parksmart-q73kd",
  storageBucket: "parksmart-q73kd.appspot.com", // Corrected: appspot.com instead of firebasestorage.app
  messagingSenderId: "825624994828",
  appId: "1:825624994828:web:c0d88f84da6078023f7a29"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);

export { app, auth, db };

