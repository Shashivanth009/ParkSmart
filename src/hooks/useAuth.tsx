
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
  profile?: UserProfile;
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
        console.warn("fetchUserProfileData: Firebase not ready or no user provided.", { firebaseInitialized, isDbNull: db === null, firebaseUserUid: firebaseUser?.uid });
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
      console.warn("updateUserProfileData: Firebase services not ready or no current auth user.", { firebaseInitialized, isDbNull: db === null, isAuthNull: auth === null, isAuthCurrentUserNull: auth?.currentUser === null });
      if (auth && auth.app) console.log("Auth App options at updateUserProfileData attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Firestore or Auth service unavailable.");
    }
    
    const userDocRef = doc(db, 'users', userId);
    const firestoreData: any = { ...data, updatedAt: serverTimestamp() };
    
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
          const updatedProfile = await fetchUserProfileData(auth.currentUser); 
          setUser(currentUser => currentUser ? ({ 
            ...currentUser, 
            displayName: authProfileUpdates.displayName || currentUser.displayName,
            photoURL: authProfileUpdates.photoURL || currentUser.photoURL,
            profile: updatedProfile || currentUser.profile 
          }) : null);
      }
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    } catch (error) {
        console.error("Error updating profile:", error);
        toast({ title: "Update Failed", description: "Could not save profile changes.", variant: "destructive" });
        throw error;
    }
  }, [user, fetchUserProfileData]);

  useEffect(() => {
    if (!firebaseInitialized) {
      setLoading(false);
      setUser(null);
      const errorMsg = firebaseInitializationError?.message || 'Firebase initialization failed.';
      console.error("AuthProvider: Firebase not initialized. Auth features disabled. Error:", firebaseInitializationError);
      
      const currentPath = window.location.pathname;
      const nonAuthPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
      const isNonAuthPage = nonAuthPaths.some(p => currentPath === p || (currentPath.startsWith(p) && p !== '/'));

      if (!isNonAuthPage) { 
        toast({
            title: "Application Error",
            description: `Authentication services unavailable: ${errorMsg}`,
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
          description: "Authentication service (auth) is not available.",
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
          const profile = await fetchUserProfileData(firebaseUser);
          console.log("AuthProvider: Profile fetched for", firebaseUser.uid, "Profile data:", profile);
          setUser({ 
              ...firebaseUser, 
              displayName: profile?.name || firebaseUser.displayName,
              photoURL: profile?.avatarUrl || firebaseUser.photoURL,
              profile: profile || undefined 
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
      toast({ title: "Login Failed", description: "Auth service unavailable. Please check your Firebase configuration in src/lib/firebase.ts.", variant: "destructive" });
      console.error("loginWithEmail: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at loginWithEmail attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    console.log("loginWithEmail: Attempting login for", email);
    if (auth && auth.app) {
        console.log("loginWithEmail: Auth App options before signInWithEmailAndPassword:", JSON.parse(JSON.stringify(auth.app.options)));
    } else {
        console.error("loginWithEmail: Auth object or auth.app is null/undefined before signInWithEmailAndPassword.");
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
      const profile = await fetchUserProfileData(userCredential.user);
      setUser({ 
        ...userCredential.user, 
        displayName: profile?.name || userCredential.user.displayName,
        photoURL: profile?.avatarUrl || userCredential.user.photoURL,
        profile: profile || undefined 
      });
      const redirectParam = searchParams.get('redirect');
      router.push(redirectParam || '/dashboard');
    } catch (error: any) {
      console.error("Email login error:", error);
       let description = "Invalid credentials or unverified email.";
      if (error.code === 'auth/configuration-not-found') {
        description = "Firebase configuration error. Please check src/lib/firebase.ts and your Firebase project settings.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "Login Failed", description, variant: "destructive" });
      setUser(null); 
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Google Login Failed", description: "Auth service unavailable. Please check your Firebase configuration in src/lib/firebase.ts.", variant: "destructive" });
      console.error("loginWithGoogle: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at loginWithGoogle attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    console.log("loginWithGoogle: Attempting Google Sign-In.");
     if (auth && auth.app) {
        console.log("loginWithGoogle: Auth App options before signInWithPopup:", JSON.parse(JSON.stringify(auth.app.options)));
    } else {
        console.error("loginWithGoogle: Auth object or auth.app is null/undefined before signInWithPopup.");
    }

    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfileData: UserProfile;

      if (!userDocSnap.exists()) {
        console.log("loginWithGoogle: New user via Google. Creating profile for:", firebaseUser.uid);
        userProfileData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '', 
          avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || 'G')[0]}`,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
          preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
        };
        await setDoc(userDocRef, userProfileData);
      } else {
        console.log("loginWithGoogle: Existing user via Google. Profile data:", userDocSnap.data());
        userProfileData = userDocSnap.data() as UserProfile;
        const updates: Partial<UserProfile> = {updatedAt: serverTimestamp() as Timestamp};
        
        if (firebaseUser.displayName && firebaseUser.displayName !== userProfileData.name) {
            updates.name = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== userProfileData.avatarUrl) {
            updates.avatarUrl = firebaseUser.photoURL;
        }
        if (firebaseUser.email && firebaseUser.email !== userProfileData.email) { 
            updates.email = firebaseUser.email;
        }

        if (Object.keys(updates).length > 1) { 
            console.log("loginWithGoogle: Updating existing user profile with:", updates);
            await updateDoc(userDocRef, updates);
            userProfileData = {...userProfileData, ...updates}; 
        }
      }
      
      setUser({ 
        ...firebaseUser, 
        displayName: userProfileData.name || firebaseUser.displayName, 
        photoURL: userProfileData.avatarUrl || firebaseUser.photoURL, 
        profile: userProfileData 
      });
      
      const redirectParam = searchParams.get('redirect');
      router.push(redirectParam || '/dashboard');

    } catch (error: any) {
      console.error("Google login error:", error);
      let description = "Could not sign in with Google.";
      if (error.code === 'auth/configuration-not-found') {
        description = "Firebase configuration error for Google Sign-In. Check src/lib/firebase.ts and Firebase project.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ title: "Google Login Failed", description, variant: "destructive" });
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (name: string, email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Signup Failed", description: "Auth service unavailable. Please verify Firebase configuration in src/lib/firebase.ts and your Firebase project setup.", variant: "destructive" });
      console.error("signupWithEmail: Auth service unavailable or Firebase not initialized properly.", {
        firebaseInitialized,
        isAuthNull: auth === null,
        isDbNull: db === null,
        initError: firebaseInitializationError ? firebaseInitializationError.message : "No init error"
      });
      if (auth && auth.app) console.log("Auth App options at signupWithEmail attempt when service thought unavailable:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    
    console.log("signupWithEmail: Attempting signup for", email);
    if (auth && auth.app && auth.app.options) {
        console.log("signupWithEmail: Auth App options before createUserWithEmailAndPassword:", JSON.parse(JSON.stringify(auth.app.options)));
         if (!auth.app.options.apiKey) {
            console.error("CRITICAL: auth.app.options.apiKey is missing right before createUserWithEmailAndPassword!", {
                authOptions: JSON.parse(JSON.stringify(auth.app.options)),
                firebaseInitialized
            });
            toast({ title: "Configuration Error", description: "Firebase API key configuration is missing internally. Check src/lib/firebase.ts and ensure Firebase project is correctly set up.", variant: "destructive" });
            setLoading(false);
            throw new Error("Internal Firebase API key configuration missing.");
        }
    } else {
        console.error("signupWithEmail: Auth object, auth.app, or auth.app.options is null/undefined before createUserWithEmailAndPassword.");
        toast({ title: "Configuration Error", description: "Firebase auth configuration is not fully loaded. Check src/lib/firebase.ts.", variant: "destructive" });
        setLoading(false);
        throw new Error("Firebase auth configuration not fully loaded.");
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await updateFirebaseProfile(firebaseUser, { displayName: name, photoURL: `https://placehold.co/150x150.png?text=${name[0]}` });

      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '', 
        avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${name[0]}`, 
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
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
      if (error.code === 'auth/configuration-not-found') {
        description = "Firebase configuration error. Please ensure src/lib/firebase.ts has the correct Firebase project config values and that Email/Password sign-in is enabled in your Firebase console.";
      } else if (error.message) {
        description = error.message;
      }
      // Log detailed error if available
      if (error.code) {
        console.error("Firebase Error Code:", error.code);
        console.error("Firebase Error Message:", error.message);
      }
      toast({ title: "Signup Failed", description, variant: "destructive" });
      setUser(null); 
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Logout Failed", description: "Auth service unavailable.", variant: "destructive" });
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
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordResetEmailHandler = async (emailAddress: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check src/lib/firebase.ts.", variant: "destructive" });
      console.error("sendPasswordResetEmailHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at sendPasswordResetEmailHandler attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    setLoading(true);
    try {
      await firebaseSendPasswordResetEmail(auth, emailAddress);
      toast({ title: "Password Reset Email Sent", description: "If an account exists for this email, a reset link has been sent." });
    } catch (error: any) {
      console.error("Password reset email error:", error);
      toast({ title: "Error Sending Reset Email", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const confirmPasswordResetHandler = async (code: string, newPassword: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready. Check src/lib/firebase.ts.", variant: "destructive" });
      console.error("confirmPasswordResetHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError?.message });
      if (auth && auth.app) console.log("Auth App options at confirmPasswordResetHandler attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    setLoading(true);
    try {
      await firebaseConfirmPasswordReset(auth, code, newPassword);
      toast({ title: "Password Reset Successful", description: "You can now login with your new password." });
      router.push('/login');
    } catch (error: any) {
      console.error("Confirm password reset error:", error);
      toast({ title: "Password Reset Failed", description: error.message || "Invalid or expired link.", variant: "destructive" });
      throw error;
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

