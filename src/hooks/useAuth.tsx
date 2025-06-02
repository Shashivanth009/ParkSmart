
"use client";
import type { ReactNode } from 'react';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  type User as FirebaseUser,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db, firebaseInitialized, firebaseInitializationError } from '@/lib/firebase';
import type { UserProfile } from '@/types';
import { toast } from '@/hooks/use-toast';

export interface AuthUser extends FirebaseUser {
  profile: UserProfile;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signupWithEmail: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  confirmPasswordReset: (code: string, newPassword: string) => Promise<void>;
  fetchUserProfileData: (firebaseUser: FirebaseUser) => Promise<UserProfile | null>;
  updateUserProfileData: (userId: string, data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fetchUserProfileData = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseInitialized || !db || !firebaseUser) {
        console.log("fetchUserProfileData: Firebase not ready or no user provided.", { firebaseInitialized, isDbNull: db === null, firebaseUserUid: firebaseUser?.uid });
        return null;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        return userDocSnap.data() as UserProfile;
      } else {
        console.log("fetchUserProfileData: No profile document found for user:", firebaseUser.uid);
        return null;
      }
    } catch (error) {
      console.error("Error fetching user profile from Firestore:", error);
      toast({ title: "Profile Error", description: "Could not load user profile.", variant: "destructive" });
    }
    return null;
  }, []);

  const updateUserProfileData = useCallback(async (userId: string, dataToUpdate: Partial<UserProfile>): Promise<void> => {
    if (!firebaseInitialized || !db || !auth?.currentUser) {
      toast({ title: "Error", description: "Cannot update profile. Auth/DB service unavailable.", variant: "destructive" });
      return;
    }

    const userDocRef = doc(db, 'users', userId);

    // Prepare the payload for Firestore, explicitly handling undefined values for optional strings
    const firestorePayload: { [key: string]: any } = {
      updatedAt: serverTimestamp(),
    };

    // Handle top-level fields
    if (dataToUpdate.name !== undefined) {
      firestorePayload.name = dataToUpdate.name;
    }
    // For optional string fields: if key exists in dataToUpdate, and value is undefined or "", store as null. Otherwise, store value.
    if (dataToUpdate.hasOwnProperty('phone')) {
      firestorePayload.phone = (dataToUpdate.phone === undefined || dataToUpdate.phone === "") ? null : dataToUpdate.phone;
    }
    if (dataToUpdate.hasOwnProperty('avatarUrl')) {
      firestorePayload.avatarUrl = (dataToUpdate.avatarUrl === undefined || dataToUpdate.avatarUrl === "") ? null : dataToUpdate.avatarUrl;
    }

    // Handle nested preferences
    if (dataToUpdate.preferences) {
      const currentPrefs = user?.profile.preferences || {}; // Base from existing profile
      const newPrefsPayload: { [key: string]: any } = { ...currentPrefs }; // Start with existing values

      if (dataToUpdate.preferences.hasOwnProperty('defaultVehiclePlate')) {
        newPrefsPayload.defaultVehiclePlate = (dataToUpdate.preferences.defaultVehiclePlate === undefined || dataToUpdate.preferences.defaultVehiclePlate === "") ? null : dataToUpdate.preferences.defaultVehiclePlate;
      }
      if (dataToUpdate.preferences.hasOwnProperty('defaultVehicleMake')) {
        newPrefsPayload.defaultVehicleMake = (dataToUpdate.preferences.defaultVehicleMake === undefined || dataToUpdate.preferences.defaultVehicleMake === "") ? null : dataToUpdate.preferences.defaultVehicleMake;
      }
      if (dataToUpdate.preferences.hasOwnProperty('defaultVehicleModel')) {
        newPrefsPayload.defaultVehicleModel = (dataToUpdate.preferences.defaultVehicleModel === undefined || dataToUpdate.preferences.defaultVehicleModel === "") ? null : dataToUpdate.preferences.defaultVehicleModel;
      }
      if (dataToUpdate.preferences.hasOwnProperty('defaultVehicleColor')) {
        newPrefsPayload.defaultVehicleColor = (dataToUpdate.preferences.defaultVehicleColor === undefined || dataToUpdate.preferences.defaultVehicleColor === "") ? null : dataToUpdate.preferences.defaultVehicleColor;
      }
      
      // Booleans are directly assigned if present
      if (dataToUpdate.preferences.requireCovered !== undefined) {
        newPrefsPayload.requireCovered = dataToUpdate.preferences.requireCovered;
      }
      if (dataToUpdate.preferences.requireEVCharging !== undefined) {
        newPrefsPayload.requireEVCharging = dataToUpdate.preferences.requireEVCharging;
      }

      if (dataToUpdate.preferences.communication) {
        newPrefsPayload.communication = { ...(currentPrefs.communication || {}) }; // Start with existing comms prefs
        if (dataToUpdate.preferences.communication.bookingEmails !== undefined) {
          newPrefsPayload.communication.bookingEmails = dataToUpdate.preferences.communication.bookingEmails;
        }
        if (dataToUpdate.preferences.communication.promotionalEmails !== undefined) {
          newPrefsPayload.communication.promotionalEmails = dataToUpdate.preferences.communication.promotionalEmails;
        }
      }
      firestorePayload.preferences = newPrefsPayload;
    }
    
    // Auth profile updates (displayName, photoURL for FirebaseUser)
    const authProfileUpdates: { displayName?: string; photoURL?: string | null } = {};
    if (dataToUpdate.name && dataToUpdate.name !== auth.currentUser.displayName) {
        authProfileUpdates.displayName = dataToUpdate.name;
    }
    
    // If avatarUrl is explicitly set to empty string or null in the form, try to set photoURL to null
    // Otherwise, if it's a new valid URL, update it.
    if (dataToUpdate.hasOwnProperty('avatarUrl')) {
        if ((dataToUpdate.avatarUrl === "" || dataToUpdate.avatarUrl === null) && auth.currentUser.photoURL !== null) {
            authProfileUpdates.photoURL = null;
        } else if (dataToUpdate.avatarUrl && dataToUpdate.avatarUrl !== auth.currentUser.photoURL) {
            authProfileUpdates.photoURL = dataToUpdate.avatarUrl;
        }
    }

    try {
      console.log("Attempting to update Firestore with payload:", JSON.stringify(firestorePayload, null, 2));
      await updateDoc(userDocRef, firestorePayload);
      
      if (Object.keys(authProfileUpdates).length > 0 && auth.currentUser) {
          await updateFirebaseProfile(auth.currentUser, authProfileUpdates);
      }

      // Optimistically update local user state, then re-fetch for consistency
      if (user && user.uid === userId && auth.currentUser) {
          const updatedFirebaseUser = { // Create a snapshot of current FirebaseUser fields
              ...auth.currentUser,
              displayName: authProfileUpdates.displayName !== undefined ? authProfileUpdates.displayName : auth.currentUser.displayName,
              photoURL: authProfileUpdates.photoURL !== undefined ? authProfileUpdates.photoURL : auth.currentUser.photoURL,
          };
          
          // Create a merged profile for optimistic update
          const optimisticallyUpdatedProfile: UserProfile = {
            ...user.profile, // Start with current local profile
            ...(firestorePayload as Partial<UserProfile>), // Overlay with what was sent to Firestore
            // Ensure nested preferences are also merged correctly
            preferences: firestorePayload.preferences ? {
                ...user.profile.preferences,
                ...firestorePayload.preferences,
                communication: firestorePayload.preferences.communication ? {
                    ...user.profile.preferences?.communication,
                    ...firestorePayload.preferences.communication,
                } : user.profile.preferences?.communication,
            } : user.profile.preferences,
            // Ensure timestamps are present
            updatedAt: serverTimestamp() as Timestamp, // This will be a sentinel locally
          };


          setUser(currentUser => currentUser ? ({
            ...(updatedFirebaseUser as FirebaseUser), // Cast because we constructed it like a FirebaseUser
            profile: optimisticallyUpdatedProfile
          }) : null);

          // Re-fetch from Firestore for definitive state after a short delay
          // to allow server-side timestamp to be set and propagation.
          setTimeout(async () => {
            if (auth.currentUser) {
                const freshProfile = await fetchUserProfileData(auth.currentUser);
                if (freshProfile) {
                    setUser(currUser => currUser ? ({
                        ...auth.currentUser!, // Use the latest auth.currentUser
                        profile: freshProfile
                    }) : null);
                }
            }
          }, 500);
      }
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    } catch (error: any) {
        console.error("Error updating profile:", error);
        toast({ title: "Update Failed", description: "Could not save profile changes.", variant: "destructive" });
    }
  }, [user, fetchUserProfileData]);


  useEffect(() => {
    if (!firebaseInitialized) {
      setLoading(false);
      setUser(null);
      const errorMsg = firebaseInitializationError?.message || 'Firebase initialization failed.';
      console.error("AuthProvider: Firebase not initialized. Auth features disabled. Error:", firebaseInitializationError);

      const currentPath = window.location.pathname;
      const nonAuthPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/email-verification-sent'];
      const isNonAuthPage = nonAuthPaths.some(p => currentPath === p || (currentPath.startsWith(p) && p !== '/'));

      if (!isNonAuthPage) {
        toast({
            title: "Application Error",
            description: `Authentication services unavailable: ${errorMsg} Please check \`src/lib/firebase.ts\` and your Firebase project setup.`,
            variant: "destructive",
            duration: 10000,
          });
      }
      return;
    }

    if (!auth) {
        setLoading(false);
        setUser(null);
        console.error("AuthProvider: Firebase Auth service not available (auth object is null despite firebaseInitialized being true).");
        toast({
          title: "Application Error",
          description: "Authentication service (auth) is not available. Please check `src/lib/firebase.ts` and your Firebase project setup.",
          variant: "destructive",
          duration: 10000,
        });
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          const firestoreProfile = await fetchUserProfileData(firebaseUser);
          let effectiveProfile: UserProfile;

          if (firestoreProfile) {
            effectiveProfile = {
                ...firestoreProfile, // Spread existing Firestore data first
                name: firestoreProfile.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firestoreProfile.email || firebaseUser.email || '',
                avatarUrl: firestoreProfile.avatarUrl || firebaseUser.photoURL,
                preferences: { // Ensure preferences and communication sub-object exist with defaults
                    defaultVehiclePlate: firestoreProfile.preferences?.defaultVehiclePlate || "",
                    defaultVehicleMake: firestoreProfile.preferences?.defaultVehicleMake || "",
                    defaultVehicleModel: firestoreProfile.preferences?.defaultVehicleModel || "",
                    defaultVehicleColor: firestoreProfile.preferences?.defaultVehicleColor || "",
                    requireCovered: firestoreProfile.preferences?.requireCovered === true, // Ensure boolean
                    requireEVCharging: firestoreProfile.preferences?.requireEVCharging === true, // Ensure boolean
                    communication: {
                        bookingEmails: firestoreProfile.preferences?.communication?.bookingEmails !== undefined ? firestoreProfile.preferences.communication.bookingEmails : true,
                        promotionalEmails: firestoreProfile.preferences?.communication?.promotionalEmails === true, // Ensure boolean
                    }
                },
                createdAt: firestoreProfile.createdAt, // Keep existing if present
                updatedAt: firestoreProfile.updatedAt, // Keep existing if present
            };
          } else {
            // Construct default profile if none exists in Firestore
            effectiveProfile = {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '', 
              avatarUrl: firebaseUser.photoURL,
              preferences: {
                defaultVehiclePlate: '',
                defaultVehicleMake: '',
                defaultVehicleModel: '',
                defaultVehicleColor: '',
                requireCovered: false,
                requireEVCharging: false,
                communication: {
                    bookingEmails: true,
                    promotionalEmails: false,
                }
              },
              // createdAt and updatedAt will be undefined for this default profile
              // and will be set upon first save or if Google sign-in creates it.
            };
          }
          setUser({
              ...firebaseUser, 
              profile: effectiveProfile
          });
        } else {
          if (!pathname.startsWith('/login') && !pathname.startsWith('/signup') && !pathname.startsWith('/reset-password') && !pathname.startsWith('/forgot-password') && !pathname.startsWith('/email-verification-sent')) {
            toast({ title: "Email Verification Required", description: "Please check your email to verify your account before logging in.", variant: "destructive", duration: 7000 });
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfileData, pathname, searchParams]);

  const loginWithEmail = async (email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Login Failed", description: "Auth service unavailable. Please check `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setUser(null);
        toast({ title: "Verification Required", description: "Please verify your email before logging in. A new verification email has been sent if the previous one expired.", variant: "destructive", duration: 7000 });
        try {
            await sendEmailVerification(userCredential.user);
        } catch (verificationError) {
            console.error("Failed to resend verification email during login attempt:", verificationError);
        }
        router.push('/login?message=verification-sent');
        setLoading(false);
        return;
      }
      const redirectParam = searchParams.get('redirect');
      toast({ title: "Login Successful", description: `Welcome back!` });
      router.push(redirectParam || '/dashboard');
    } catch (error: any) {
      console.error("Email login error:", error);
      let description = "An unexpected error occurred during login.";
      switch (error.code) {
        case 'auth/invalid-credential':
          description = "Invalid email or password. Please try again.";
          break;
        case 'auth/user-not-found':
          description = "No account found with this email. Please sign up or check the email address.";
          break;
        case 'auth/wrong-password':
          description = "Incorrect password. Please try again or reset your password.";
          break;
        case 'auth/user-disabled':
          description = "This account has been disabled. Please contact support.";
          break;
        case 'auth/too-many-requests':
          description = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
          break;
        case 'auth/configuration-not-found':
          description = "Firebase configuration error. Please check `src/lib/firebase.ts` and your Firebase project settings in the Firebase console (ensure Email/Password sign-in is enabled).";
          break;
        case 'auth/unauthorized-domain':
          description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
          break;
        case 'auth/network-request-failed':
            description = "Network error. Please check your internet connection and try again.";
            break;
        default:
          description = error.message || "Login failed. Please try again.";
      }
      toast({ title: "Login Failed", description, variant: "destructive" });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Google Login Failed", description: "Auth service unavailable. Please check `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfileUpdates: Partial<UserProfile> = {};
      const now = serverTimestamp() as Timestamp;

      if (!userDocSnap.exists()) {
        console.log("loginWithGoogle: New user. Creating Firestore profile for:", firebaseUser.uid);
        userProfileUpdates = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL,
          createdAt: now,
          updatedAt: now,
          preferences: { 
            defaultVehiclePlate: '', defaultVehicleMake: '', defaultVehicleModel: '', defaultVehicleColor: '',
            requireCovered: false, requireEVCharging: false,
            communication: { bookingEmails: true, promotionalEmails: false } 
          }
        };
        await setDoc(userDocRef, userProfileUpdates);
      } else {
        const existingProfile = userDocSnap.data() as UserProfile;
        let needsFirestoreUpdate = false;
        const updatesForFirestore: Partial<UserProfile> = {};

        if (firebaseUser.displayName && firebaseUser.displayName !== existingProfile.name) {
            updatesForFirestore.name = firebaseUser.displayName;
            needsFirestoreUpdate = true;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== existingProfile.avatarUrl) {
            updatesForFirestore.avatarUrl = firebaseUser.photoURL;
            needsFirestoreUpdate = true;
        }
        if (firebaseUser.email && firebaseUser.email !== existingProfile.email) {
            updatesForFirestore.email = firebaseUser.email;
            needsFirestoreUpdate = true;
        }
        if (needsFirestoreUpdate) {
            updatesForFirestore.updatedAt = now;
            console.log("loginWithGoogle: Existing user. Updating Firestore profile for:", firebaseUser.uid, "with:", updatesForFirestore);
            await updateDoc(userDocRef, updatesForFirestore);
        } else {
             console.log("loginWithGoogle: Existing user. No Firestore profile updates needed for:", firebaseUser.uid);
        }
      }
      
      const redirectParam = searchParams.get('redirect');
      toast({ title: "Google Login Successful", description: `Welcome!` });
      router.push(redirectParam || '/dashboard');

    } catch (error: any) {
      console.error("Google login error:", error.code, error.message);
      let description = "Could not sign in with Google.";
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          description = "Google Sign-In popup was closed before completion. Please try again.";
          break;
        case 'auth/account-exists-with-different-credential':
          description = "An account already exists with this email address using a different sign-in method (e.g., Email/Password). Try logging in with that method.";
          break;
        case 'auth/cancelled-popup-request':
          description = "Multiple popups were opened for Google Sign-In. Please close other popups and try again.";
          break;
        case 'auth/popup-blocked':
          description = "Google Sign-In popup was blocked by the browser. Please allow popups for this site and try again.";
          break;
        case 'auth/configuration-not-found':
        case 'auth/operation-not-allowed':
          description = "Google Sign-In is not configured correctly for this app. Please ensure it's enabled in your Firebase project console (Authentication -> Sign-in method) and that your project's OAuth settings are correctly set up in Google Cloud Console.";
          break;
        case 'auth/unauthorized-domain':
          description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
          break;
        case 'auth/network-request-failed':
            description = "Network error during Google Sign-In. Please check your internet connection and try again.";
            break;
        default:
          description = error.message || "An unexpected error occurred during Google Sign-In.";
      }
      toast({ title: "Google Login Failed", description, variant: "destructive" });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

 const signupWithEmail = async (name: string, email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Signup Failed", description: "Auth service unavailable. Please verify Firebase configuration in `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      return;
    }

    if (auth && auth.app && auth.app.options) {
         if (!auth.app.options.apiKey) {
            console.error("CRITICAL: auth.app.options.apiKey is missing right before createUserWithEmailAndPassword!");
            toast({ title: "Configuration Error", description: "Firebase API key configuration is missing internally. Check `src/lib/firebase.ts` and ensure Firebase project is correctly set up.", variant: "destructive" });
            setLoading(false);
            return;
        }
    } else {
        console.error("signupWithEmail: Auth object, auth.app, or auth.app.options is null/undefined before createUserWithEmailAndPassword.");
        toast({ title: "Configuration Error", description: "Firebase auth configuration is not fully loaded. Check `src/lib/firebase.ts`.", variant: "destructive" });
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await updateFirebaseProfile(firebaseUser, { displayName: name });

      const now = serverTimestamp() as Timestamp;
      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '',
        avatarUrl: firebaseUser.photoURL, // Will be null initially
        createdAt: now,
        updatedAt: now,
        preferences: { 
            defaultVehiclePlate: '', defaultVehicleMake: '', defaultVehicleModel: '', defaultVehicleColor: '',
            requireCovered: false, requireEVCharging: false,
            communication: { bookingEmails: true, promotionalEmails: false } 
        }
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);

      await sendEmailVerification(firebaseUser);
      toast({ title: "Signup Successful", description: "Verification email sent. Please check your inbox to verify your email address.", duration: 7000 });

      await signOut(auth);
      setUser(null);
      router.push('/login?message=verification-sent');
    } catch (error: any) {
      let description = "Could not create account.";
      switch(error.code) {
        case 'auth/email-already-in-use':
          description = "This email address is already in use. Please try logging in or use a different email.";
          break;
        case 'auth/invalid-email':
          description = "The email address is not valid. Please enter a correct email.";
          break;
        case 'auth/operation-not-allowed':
          description = "Email/Password sign-in is not enabled in your Firebase project. Please enable it in Firebase Console: Authentication -> Sign-in method.";
          break;
        case 'auth/weak-password':
          description = "The password is too weak. Please choose a stronger password.";
          break;
        case 'auth/configuration-not-found':
          description = "Firebase configuration error. Please ensure `src/lib/firebase.ts` has the correct Firebase project config values and that Email/Password sign-in is enabled in your Firebase console.";
          break;
        case 'auth/unauthorized-domain':
          description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
          break;
        case 'auth/network-request-failed':
            description = "Network error. Please check your internet connection and try again.";
            break;
        default:
          description = error.message || "An unexpected error occurred during signup. Please try again.";
      }
      if (error.code) {
        console.error("Firebase Error Code:", error.code);
        console.error("Firebase Error Message:", error.message);
      }
      toast({ title: "Signup Failed", description, variant: "destructive" });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Logout Failed", description: "Auth service unavailable. Check `src/lib/firebase.ts`.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      router.push('/login');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error: any) {
      toast({ title: "Logout Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordResetEmailHandler = async (emailAddress: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check `src/lib/firebase.ts`.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await firebaseSendPasswordResetEmail(auth, emailAddress);
      toast({ title: "Password Reset Email Sent", description: "If an account exists for this email, a reset link has been sent." });
    } catch (error: any)
     {
      let description = "Could not send reset email.";
       if (error.code === 'auth/user-not-found') {
        description = "No account found with this email address.";
      } else if (error.code === 'auth/configuration-not-found') {
        description = "Firebase configuration error for password reset. Check `src/lib/firebase.ts` and Firebase console settings.";
      } else if (error.code === 'auth/unauthorized-domain') {
        description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "Error Sending Reset Email", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmPasswordResetHandler = async (code: string, newPassword: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check `src/lib/firebase.ts`.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await firebaseConfirmPasswordReset(auth, code, newPassword);
      toast({ title: "Password Reset Successful", description: "You can now login with your new password." });
      router.push('/login');
    } catch (error: any) {
      let description = "Failed to reset password.";
      if (error.code === 'auth/invalid-action-code') {
        description = "The password reset link is invalid or has expired. Please request a new one.";
      } else if (error.code === 'auth/configuration-not-found') {
        description = "Firebase configuration error for password reset. Check `src/lib/firebase.ts` and Firebase console settings.";
      } else if (error.code === 'auth/unauthorized-domain') {
        description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "Password Reset Failed", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!user && !!user.emailVerified;

  return (
    <AuthContext.Provider value={{
        user,
        loading,
        isAuthenticated,
        loginWithEmail,
        loginWithGoogle,
        signupWithEmail,
        logout,
        sendPasswordResetEmail: sendPasswordResetEmailHandler,
        confirmPasswordReset: confirmPasswordResetHandler,
        fetchUserProfileData,
        updateUserProfileData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
