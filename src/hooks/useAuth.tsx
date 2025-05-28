
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
      await updateDoc(userDocRef, firestoreData); 
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
      const isAuthPath = nonAuthPaths.some(p => currentPath.startsWith(p));

      if (!isAuthPath) { // Only show toast if not on an auth page, to avoid spamming during redirection.
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: onAuthStateChanged triggered. FirebaseUser:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          console.log("AuthProvider: User email is verified. Fetching profile for", firebaseUser.uid);
          const profile = await fetchUserProfileData(firebaseUser);
          console.log("AuthProvider: Profile fetched for", firebaseUser.uid, ":", profile);
          setUser({ 
              ...firebaseUser, 
              displayName: profile?.name || firebaseUser.displayName,
              photoURL: profile?.avatarUrl || firebaseUser.photoURL,
              profile: profile || undefined 
          });
        } else {
          console.log("AuthProvider: User email NOT verified for", firebaseUser.uid);
          if (!pathname.startsWith('/login') && !pathname.startsWith('/signup') && !pathname.startsWith('/reset-password') && !pathname.startsWith('/forgot-password')) {
            toast({ title: "Email Verification Required", description: "Please check your email to verify your account before logging in.", variant: "destructive", duration: 7000 });
            // Don't sign out here if they just signed up, let them go to login page with message.
            // await signOut(auth); 
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
    if (!firebaseInitialized || !auth) {
      toast({ title: "Login Failed", description: "Auth service unavailable.", variant: "destructive" });
      console.error("loginWithEmail: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError });
      if (auth && auth.app) console.log("Auth App options at loginWithEmail attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await signOut(auth); // Sign out unverified user
        setUser(null); 
        toast({ title: "Verification Required", description: "Please verify your email before logging in. A new verification email has been sent if the previous one expired.", variant: "destructive", duration: 7000 });
        try {
            await sendEmailVerification(userCredential.user); // Attempt to resend verification
        } catch (verificationError) {
            console.error("Failed to resend verification email during login attempt:", verificationError);
        }
        router.push('/login?message=verification-sent'); // Redirect to login with message
        setLoading(false);
        return; // Stop further execution for unverified user
      }
      // User is verified, proceed to fetch profile and set user
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
      toast({ title: "Login Failed", description: error.message || "Invalid credentials or unverified email.", variant: "destructive" });
      setUser(null); // Ensure user state is cleared on error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Google Login Failed", description: "Auth service unavailable.", variant: "destructive" });
      console.error("loginWithGoogle: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError });
      if (auth && auth.app) console.log("Auth App options at loginWithGoogle attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // For Google Sign-In, email is always considered verified by Firebase
      // So we directly proceed to create/update profile in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfileData: UserProfile;

      if (!userDocSnap.exists()) {
        // New user via Google Sign-In
        userProfileData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '', // Google users always have an email
          avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || 'G')[0]}`,
          createdAt: serverTimestamp() as Timestamp,
          preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
        };
        await setDoc(userDocRef, userProfileData);
      } else {
        // Existing user, update if necessary
        userProfileData = userDocSnap.data() as UserProfile;
        const updates: Partial<UserProfile> = {updatedAt: serverTimestamp() as Timestamp};
        // Sync name and avatar from Google profile if changed
        if (firebaseUser.displayName && firebaseUser.displayName !== userProfileData.name) {
            updates.name = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== userProfileData.avatarUrl) {
            updates.avatarUrl = firebaseUser.photoURL;
        }
        if (firebaseUser.email && firebaseUser.email !== userProfileData.email) { // Should not happen often with Google but good to check
            updates.email = firebaseUser.email;
        }

        if (Object.keys(updates).length > 1) { // At least updatedAt will be there
            await updateDoc(userDocRef, updates);
            userProfileData = {...userProfileData, ...updates}; // Reflect updates locally
        }
      }
      
      // Set the user in context
      setUser({ 
        ...firebaseUser, 
        displayName: userProfileData.name || firebaseUser.displayName, // Use profile name if available
        photoURL: userProfileData.avatarUrl || firebaseUser.photoURL, // Use profile avatar if available
        profile: userProfileData 
      });
      
      const redirectParam = searchParams.get('redirect');
      router.push(redirectParam || '/dashboard');

    } catch (error: any) {
      console.error("Google login error:", error);
      toast({ title: "Google Login Failed", description: error.message || "Could not sign in with Google.", variant: "destructive" });
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (name: string, email: string, password: string) => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Signup Failed", description: "Auth service unavailable.", variant: "destructive" });
      console.error("signupWithEmail: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, isDbNull: db === null, error: firebaseInitializationError });
      if (auth && auth.app) console.log("Auth App options at signupWithEmail attempt:", JSON.parse(JSON.stringify(auth.app.options)));
      throw new Error("Auth service unavailable.");
    }
    console.log("Auth options just before signup:", JSON.parse(JSON.stringify(auth.app.options)));
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Update Firebase Auth profile (displayName, photoURL)
      await updateFirebaseProfile(firebaseUser, { displayName: name, photoURL: `https://placehold.co/150x150.png?text=${name[0]}` });

      // Create user profile in Firestore
      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '', // Should always exist after creation
        avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${name[0]}`, // Use updated photoURL
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
      
      // Send verification email
      await sendEmailVerification(firebaseUser);
      toast({ title: "Signup Successful", description: "Verification email sent. Please check your inbox to verify your email address.", duration: 7000 });
      
      await signOut(auth); // Sign out the user immediately after signup so they must verify
      setUser(null); // Clear user state
      router.push('/login?message=verification-sent'); // Redirect to login with a message
    } catch (error: any) {
      console.error("Signup error:", error);
      // Log detailed error if available
      if (error.code) {
        console.error("Firebase Error Code:", error.code);
        console.error("Firebase Error Message:", error.message);
      }
      toast({ title: "Signup Failed", description: error.message || "Could not create account.", variant: "destructive" });
      setUser(null); // Ensure user state is cleared on error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Logout Failed", description: "Auth service unavailable.", variant: "destructive" });
      console.error("logout: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError });
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
      toast({ title: "Error", description: "Password reset service not ready.", variant: "destructive" });
      console.error("sendPasswordResetEmailHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError });
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
      toast({ title: "Error", description: "Password reset service not ready.", variant: "destructive" });
      console.error("confirmPasswordResetHandler: Firebase services not ready.", { firebaseInitialized, isAuthNull: auth === null, error: firebaseInitializationError });
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

