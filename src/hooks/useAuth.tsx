
"use client";
import type { ReactNode } from 'react';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  updateProfile as updateFirebaseProfile, // For updating displayName/photoURL in Firebase Auth user
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db, firebaseInitialized, firebaseInitializationError } from '@/lib/firebase'; // Assuming firebase.ts exports auth and db
import type { UserProfile } from '@/types'; // Ensure this type aligns with your Firestore structure
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

  const fetchUserProfileData = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!db || !firebaseUser) return null; // Check if db is initialized
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        return userDocSnap.data() as UserProfile;
      }
    } catch (error) {
      console.error("Error fetching user profile from Firestore:", error);
    }
    return null;
  }, []);
  
  const updateUserProfileData = useCallback(async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    if (!db || !auth?.currentUser) { // Check if db and auth are initialized
      toast({ title: "Error", description: "Cannot update profile. Service unavailable.", variant: "destructive" });
      throw new Error("Firestore or Auth service unavailable.");
    }
    
    const userDocRef = doc(db, 'users', userId);
    const firestoreData: any = { ...data, updatedAt: serverTimestamp() };
    
    // Separate Firebase Auth profile updates (displayName, photoURL)
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
      
      // Optimistically update local state or re-fetch
      if (user && user.uid === userId) {
          const updatedProfile = await fetchUserProfileData(user); // Re-fetch to get fresh data including serverTimestamp
          setUser(currentUser => currentUser ? ({ 
            ...currentUser, 
            displayName: authProfileUpdates.displayName || currentUser.displayName, // Update auth fields directly
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
      console.error("Firebase not initialized in AuthProvider. Auth features disabled.", firebaseInitializationError);
      toast({
        title: "Application Initialization Error",
        description: `Could not connect to backend services. Authentication features may be unavailable. Details: ${firebaseInitializationError?.message || 'Unknown error'}`,
        variant: "destructive",
        duration: 10000, // Show longer
      });
      return;
    }
    
    if (!auth) {
        setLoading(false);
        setUser(null);
        console.error("Firebase Auth service not available in AuthProvider.");
        return; 
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfileData(firebaseUser);
        setUser({ 
            ...firebaseUser, 
            // Ensure displayName and photoURL on the root user object are also consistent
            displayName: profile?.name || firebaseUser.displayName,
            photoURL: profile?.avatarUrl || firebaseUser.photoURL,
            profile: profile || undefined 
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfileData]);

  const loginWithEmail = async (email: string, password: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Login Failed", description: "Authentication service not ready.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setUser(null);
        toast({ title: "Verification Required", description: "Please verify your email before logging in. A new verification email has been sent.", variant: "destructive", duration: 7000 });
        await sendEmailVerification(userCredential.user);
        router.push('/login?message=verification-sent'); // or a specific "please verify" page
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
      const redirectPath = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectPath);
    } catch (error: any) {
      console.error("Email login error:", error);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials.", variant: "destructive" });
      setUser(null); 
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseInitialized || !auth || !db) {
      toast({ title: "Google Login Failed", description: "Authentication service not ready.", variant: "destructive" });
      return;
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
        userProfileData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || 'G')[0]}`,
          createdAt: serverTimestamp() as Timestamp, // Cast for new docs
          preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
        };
        await setDoc(userDocRef, userProfileData);
      } else {
        userProfileData = userDocSnap.data() as UserProfile;
        const updates: Partial<UserProfile> = {};
        if (firebaseUser.displayName && firebaseUser.displayName !== userProfileData.name) {
            updates.name = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== userProfileData.avatarUrl) {
            updates.avatarUrl = firebaseUser.photoURL;
        }
        if (Object.keys(updates).length > 0) {
            await updateDoc(userDocRef, {...updates, updatedAt: serverTimestamp()});
            userProfileData = {...userProfileData, ...updates};
        }
      }
      setUser({ 
        ...firebaseUser, 
        displayName: userProfileData.name || firebaseUser.displayName,
        photoURL: userProfileData.avatarUrl || firebaseUser.photoURL,
        profile: userProfileData 
      });
      const redirectPath = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectPath);
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
      toast({ title: "Signup Failed", description: "Authentication service not ready.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Update Firebase Auth profile immediately
      await updateFirebaseProfile(firebaseUser, { displayName: name, photoURL: `https://placehold.co/150x150.png?text=${name[0]}` });

      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '', 
        avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${name[0]}`,
        createdAt: serverTimestamp() as Timestamp,
        preferences: { defaultVehiclePlate: '', requireCovered: false, requireEVCharging: false }
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
      
      await sendEmailVerification(firebaseUser);
      toast({ title: "Signup Successful", description: "Verification email sent. Please check your inbox to verify your email address.", duration: 7000 });
      await signOut(auth);
      setUser(null);
      router.push('/login?message=verification-sent');
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({ title: "Signup Failed", description: error.message || "Could not create account.", variant: "destructive" });
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Logout Failed", description: "Authentication service not ready.", variant: "destructive" });
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

  const sendPasswordResetEmail = async (emailAddress: string) => {
    if (!firebaseInitialized || !auth) {
      toast({ title: "Error", description: "Password reset service not ready.", variant: "destructive" });
      return;
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
      return;
    }
    setLoading(true);
    try {
      await firebaseConfirmPasswordReset(auth, code, newPassword);
      toast({ title: "Password Reset Successful", description: "You can now login with your new password." });
      router.push('/login');
    } catch (error: any) {
      console.error("Confirm password reset error:", error);
      toast({ title: "Password Reset Failed", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };


  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        isAuthenticated, 
        loginWithEmail, 
        loginWithGoogle, 
        signupWithEmail, 
        logout, 
        sendPasswordResetEmail,
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
