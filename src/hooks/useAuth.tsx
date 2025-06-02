
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

// Updated AuthUser to make profile non-optional
export interface AuthUser extends FirebaseUser {
  profile: UserProfile; // Profile is guaranteed if AuthUser is not null
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
  fetchUserProfileData: (firebaseUser: FirebaseUser) => Promise<UserProfile | null>; // Returns null if not found
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

  const updateUserProfileData = useCallback(async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    if (!firebaseInitialized || !db || !auth?.currentUser) {
      toast({ title: "Error", description: "Cannot update profile. Auth/DB service unavailable.", variant: "destructive" });
      console.error("updateUserProfileData: Firebase services not ready or no current auth user.", { firebaseInitialized, isDbNull: db === null, isAuthNull: auth === null, isAuthCurrentUserNull: auth?.currentUser === null });
      if (auth && auth.app) console.log("Auth App options at updateUserProfileData attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }

    const userDocRef = doc(db, 'users', userId);
    const firestoreData: any = { ...data, updatedAt: serverTimestamp() };
     // Ensure preferences is structured correctly for Firestore merge
    if (data.preferences) {
        firestoreData.preferences = {
            ...data.preferences, // new preferences
            communication: {
                ...data.preferences.communication // new communication prefs
            }
        };
    }


    const authProfileUpdates: { displayName?: string; photoURL?: string } = {};
    if (data.name && data.name !== auth.currentUser.displayName) {
        authProfileUpdates.displayName = data.name;
    }
    if (data.avatarUrl && data.avatarUrl !== auth.currentUser.photoURL) {
        authProfileUpdates.photoURL = data.avatarUrl;
    }

    try {
      await updateDoc(userDocRef, firestoreData, { merge: true });
      if (Object.keys(authProfileUpdates).length > 0 && auth.currentUser) {
          await updateFirebaseProfile(auth.currentUser, authProfileUpdates);
      }

      if (user && user.uid === userId && auth.currentUser) {
          const firestoreProfileAfterUpdate = await fetchUserProfileData(auth.currentUser);
          let newEffectiveProfile: UserProfile;
          if (firestoreProfileAfterUpdate) {
            newEffectiveProfile = firestoreProfileAfterUpdate;
          } else {
            console.warn("updateUserProfileData: Profile not found immediately after update for user:", userId, "Falling back to current user profile state.");
            newEffectiveProfile = user.profile; // Fallback, should be rare
          }

          setUser(currentUser => currentUser ? ({
            ...currentUser, 
            displayName: auth.currentUser?.displayName,
            photoURL: auth.currentUser?.photoURL,
            email: auth.currentUser?.email, 
            profile: newEffectiveProfile 
          }) : null);
      }
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    } catch (error: any) {
        console.error("Error updating profile:", error);
        toast({ title: "Update Failed", description: "Could not save profile changes.", variant: "destructive" });
        // Do not re-throw, let toast handle user feedback
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

    console.log("AuthProvider: Setting up onAuthStateChanged listener. Firebase Initialized:", firebaseInitialized, "Auth Ready:", !!auth);
    if (auth && auth.app) {
        console.log("AuthProvider: Auth App options at onAuthStateChanged setup:", JSON.parse(JSON.stringify(auth.app.options)));
    } else {
        console.warn("AuthProvider: Auth object or auth.app is null/undefined at onAuthStateChanged setup.");
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: onAuthStateChanged triggered. FirebaseUser:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          console.log("AuthProvider: User email is verified. Fetching profile for", firebaseUser.uid);
          const firestoreProfile = await fetchUserProfileData(firebaseUser);

          let effectiveProfile: UserProfile;
          if (firestoreProfile) {
            effectiveProfile = { // Ensure all fields are present, defaulting if necessary from Firestore data
                ...firestoreProfile,
                name: firestoreProfile.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firestoreProfile.email || firebaseUser.email || '',
                avatarUrl: firestoreProfile.avatarUrl || firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firestoreProfile.name || firebaseUser.displayName || firebaseUser.email || 'U').charAt(0).toUpperCase()}`,
                preferences: {
                    defaultVehiclePlate: firestoreProfile.preferences?.defaultVehiclePlate || "",
                    defaultVehicleMake: firestoreProfile.preferences?.defaultVehicleMake || "",
                    defaultVehicleModel: firestoreProfile.preferences?.defaultVehicleModel || "",
                    defaultVehicleColor: firestoreProfile.preferences?.defaultVehicleColor || "",
                    requireCovered: firestoreProfile.preferences?.requireCovered === true,
                    requireEVCharging: firestoreProfile.preferences?.requireEVCharging === true,
                    communication: {
                        bookingEmails: firestoreProfile.preferences?.communication?.bookingEmails !== undefined ? firestoreProfile.preferences.communication.bookingEmails : true,
                        promotionalEmails: firestoreProfile.preferences?.communication?.promotionalEmails === true,
                    }
                },
                // createdAt and updatedAt should come from firestoreProfile if they exist
            };
          } else {
            console.log("AuthProvider: No Firestore profile for verified user", firebaseUser.uid, ". Constructing default in-memory profile.");
            effectiveProfile = {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '', 
              avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || firebaseUser.email || 'U').charAt(0).toUpperCase()}`,
              preferences: {
                defaultVehiclePlate: '',
                defaultVehicleMake: '',
                defaultVehicleModel: '',
                defaultVehicleColor: '',
                requireCovered: false,
                requireEVCharging: false,
                communication: {
                    bookingEmails: true, // Default to true
                    promotionalEmails: false, // Default to false
                }
              }
            };
          }
          console.log("AuthProvider: Effective profile for", firebaseUser.uid, "is:", effectiveProfile);
          setUser({
              ...firebaseUser, 
              profile: effectiveProfile
          });
        } else {
          console.log("AuthProvider: User email NOT verified for", firebaseUser.uid);
          if (!pathname.startsWith('/login') && !pathname.startsWith('/signup') && !pathname.startsWith('/reset-password') && !pathname.startsWith('/forgot-password')  && !pathname.startsWith('/email-verification-sent')) {
            toast({ title: "Email Verification Required", description: "Please check your email to verify your account before logging in.", variant: "destructive", duration: 7000 });
          }
          setUser(null);
        }
      } else {
        console.log("AuthProvider: No FirebaseUser.");
        setUser(null);
      }
      setLoading(false);
    });
    return () => {
        console.log("AuthProvider: Unsubscribing from onAuthStateChanged.");
        unsubscribe();
    }
  }, [fetchUserProfileData, pathname, router, searchParams]);

  const loginWithEmail = async (email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Login Failed", description: "Auth service unavailable. Please check `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      console.error("loginWithEmail: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at loginWithEmail attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }
    console.log("loginWithEmail: Attempting login for", email);
    if (auth && auth.app) {
        console.log("loginWithEmail: Auth App options before signInWithEmailAndPassword:", JSON.parse(JSON.stringify(auth.app.options)));
    } else {
        console.error("loginWithEmail: Auth object or auth.app is null/undefined before signInWithEmailAndPassword.");
        toast({ title: "Login Failed", description: "Firebase auth configuration not fully loaded.", variant: "destructive" });
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
      toast({ title: "Login Successful", description: `Welcome back, ${userCredential.user.displayName || 'User'}!` });
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
      // Do not re-throw
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Google Login Failed", description: "Auth service unavailable. Please check `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      console.error("loginWithGoogle: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at loginWithGoogle attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }
    console.log("loginWithGoogle: Attempting Google Sign-In.");
     if (auth && auth.app) {
        console.log("loginWithGoogle: Auth App options before signInWithPopup:", JSON.parse(JSON.stringify(auth.app.options)));
    } else {
        console.error("loginWithGoogle: Auth object or auth.app is null/undefined before signInWithPopup.");
        toast({ title: "Google Login Failed", description: "Firebase auth configuration not fully loaded.", variant: "destructive" });
        return;
    }

    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfileDataToSave: Partial<UserProfile> = {}; 

      if (!userDocSnap.exists()) {
        console.log("loginWithGoogle: New user via Google. Creating profile for:", firebaseUser.uid);
        userProfileDataToSave = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || 'G')[0].toUpperCase()}`,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
          preferences: { 
            defaultVehiclePlate: '', 
            defaultVehicleMake: '',
            defaultVehicleModel: '',
            defaultVehicleColor: '',
            requireCovered: false, 
            requireEVCharging: false,
            communication: { bookingEmails: true, promotionalEmails: false } 
          }
        };
        await setDoc(userDocRef, userProfileDataToSave);
      } else {
        console.log("loginWithGoogle: Existing user via Google. Current Firestore profile data:", userDocSnap.data());
        const existingProfile = userDocSnap.data() as UserProfile;
        userProfileDataToSave = { updatedAt: serverTimestamp() as Timestamp }; 

        if (firebaseUser.displayName && firebaseUser.displayName !== existingProfile.name) {
            userProfileDataToSave.name = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== existingProfile.avatarUrl) {
            userProfileDataToSave.avatarUrl = firebaseUser.photoURL;
        }
        if (firebaseUser.email && firebaseUser.email !== existingProfile.email) {
            userProfileDataToSave.email = firebaseUser.email;
        }

        if (Object.keys(userProfileDataToSave).length > 1) { 
            console.log("loginWithGoogle: Updating existing user profile in Firestore with:", userProfileDataToSave);
            await updateDoc(userDocRef, userProfileDataToSave);
        }
      }
      const redirectParam = searchParams.get('redirect');
      toast({ title: "Google Login Successful", description: `Welcome, ${firebaseUser.displayName || 'User'}!` });
      router.push(redirectParam || '/dashboard');

    } catch (error: any) {
      console.error("Google login error:", error);
      let description = "Could not sign in with Google.";
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          description = "Google Sign-In popup was closed. Please try again.";
          break;
        case 'auth/account-exists-with-different-credential':
          description = "An account already exists with this email address using a different sign-in method.";
          break;
        case 'auth/cancelled-popup-request':
          description = "Multiple popups were opened. Please close other popups and try again.";
          break;
        case 'auth/popup-blocked':
          description = "Google Sign-In popup was blocked by the browser. Please allow popups for this site.";
          break;
        case 'auth/configuration-not-found':
          description = "Firebase configuration error for Google Sign-In. Check `src/lib/firebase.ts` and ensure Google Sign-In is enabled with correct OAuth setup in your Firebase console.";
          break;
        case 'auth/unauthorized-domain':
          description = "This domain is not authorized for Firebase operations. Please add it to the authorized domains list in your Firebase project console: Authentication -> Settings -> Authorized domains.";
          break;
        case 'auth/network-request-failed':
            description = "Network error. Please check your internet connection and try again.";
            break;
        default:
          description = error.message || "An unexpected error occurred during Google Sign-In.";
      }
      toast({ title: "Google Login Failed", description, variant: "destructive" });
      setUser(null);
      // Do not re-throw
    } finally {
      setLoading(false);
    }
  };

 const signupWithEmail = async (name: string, email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Signup Failed", description: "Auth service unavailable. Please verify Firebase configuration in `src/lib/firebase.ts` and your Firebase project setup.", variant: "destructive" });
      console.error("signupWithEmail: Auth service unavailable or Firebase not initialized properly.", {
        firebaseInitialized,
        isAuthNull: auth === null,
        isDbNull: db === null,
        initError: firebaseInitializationError ? firebaseInitializationError.message : "No init error"
      });
      if (auth && auth.app) console.log("Auth App options at signupWithEmail attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }

    console.log("signupWithEmail: Attempting signup for", email);
    if (auth && auth.app && auth.app.options) {
        console.log("signupWithEmail: Auth App options before createUserWithEmailAndPassword:", JSON.parse(JSON.stringify(auth.app.options)));
         if (!auth.app.options.apiKey) {
            console.error("CRITICAL: auth.app.options.apiKey is missing right before createUserWithEmailAndPassword!", {
                authOptions: JSON.parse(JSON.stringify(auth.app.options)),
                firebaseInitialized
            });
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

      await updateFirebaseProfile(firebaseUser, { displayName: name, photoURL: `https://placehold.co/150x150.png?text=${name[0].toUpperCase()}` });

      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '',
        avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${name[0].toUpperCase()}`,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        preferences: { 
            defaultVehiclePlate: '', 
            defaultVehicleMake: '',
            defaultVehicleModel: '',
            defaultVehicleColor: '',
            requireCovered: false, 
            requireEVCharging: false,
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
      console.error("Signup attempt failed. Raw error:", error);
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
      // Do not re-throw
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Logout Failed", description: "Auth service unavailable. Check `src/lib/firebase.ts`.", variant: "destructive" });
      console.error("logout: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at logout attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      router.push('/login');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      // Do not re-throw
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordResetEmailHandler = async (emailAddress: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check `src/lib/firebase.ts`.", variant: "destructive" });
      console.error("sendPasswordResetEmailHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at sendPasswordResetEmailHandler attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }
    setLoading(true);
    try {
      await firebaseSendPasswordResetEmail(auth, emailAddress);
      toast({ title: "Password Reset Email Sent", description: "If an account exists for this email, a reset link has been sent." });
    } catch (error: any) {
      console.error("Password reset email error:", error);
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
      // Do not re-throw
    } finally {
      setLoading(false);
    }
  };

  const confirmPasswordResetHandler = async (code: string, newPassword: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check `src/lib/firebase.ts`.", variant: "destructive" });
      console.error("confirmPasswordResetHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at confirmPasswordResetHandler attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      return;
    }
    setLoading(true);
    try {
      await firebaseConfirmPasswordReset(auth, code, newPassword);
      toast({ title: "Password Reset Successful", description: "You can now login with your new password." });
      router.push('/login');
    } catch (error: any) {
      console.error("Confirm password reset error:", error);
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
      // Do not re-throw
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
