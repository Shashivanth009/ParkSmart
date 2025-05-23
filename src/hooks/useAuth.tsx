
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
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; // Assuming firebase.ts exports auth and db
import type { UserProfile } from '@/types'; // Ensure this type aligns with your Firestore structure
import { toast } from '@/hooks/use-toast';

export interface AuthUser extends FirebaseUser {
  profile?: UserProfile; // Optional: merge Firestore profile data here
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
    if (!firebaseUser) return null;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data() as UserProfile;
    }
    return null;
  }, []);
  
  const updateUserProfileData = useCallback(async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, data);
    // Optionally re-fetch user profile to update context
    if (user && user.uid === userId) {
        const updatedProfile = await fetchUserProfileData(user);
        setUser(currentUser => currentUser ? ({ ...currentUser, profile: updatedProfile || undefined }) : null);
    }
  }, [user, fetchUserProfileData]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfileData(firebaseUser);
        setUser({ ...firebaseUser, profile: profile || undefined });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfileData]);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchUserProfileData(userCredential.user);
      setUser({ ...userCredential.user, profile: profile || undefined });
      // Redirect based on where the user was trying to go, or dashboard
      const redirectPath = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectPath);
    } catch (error: any) {
      console.error("Email login error:", error);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials.", variant: "destructive" });
      setUser(null); // Ensure user is null on error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Check if user profile exists in Firestore, create if not
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userProfileData: UserProfile;

      if (!userDocSnap.exists()) {
        userProfileData = {
          name: firebaseUser.displayName || 'Google User',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || `https://placehold.co/150x150.png?text=${(firebaseUser.displayName || 'G')[0]}`,
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, userProfileData);
      } else {
        userProfileData = userDocSnap.data() as UserProfile;
         // Optionally update avatar if it changed in Google
        if (firebaseUser.photoURL && firebaseUser.photoURL !== userProfileData.avatarUrl) {
            await updateDoc(userDocRef, { avatarUrl: firebaseUser.photoURL });
            userProfileData.avatarUrl = firebaseUser.photoURL;
        }
      }
      setUser({ ...firebaseUser, profile: userProfileData });
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
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user profile in Firestore
      const userProfileData: UserProfile = {
        name: name,
        email: firebaseUser.email || '', // Should always exist
        avatarUrl: `https://placehold.co/150x150.png?text=${name[0]}`, // Default avatar
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
      
      await sendEmailVerification(firebaseUser);
      toast({ title: "Signup Successful", description: "Verification email sent. Please check your inbox." });
      // Don't log in user immediately, let them verify first (or log them in and handle verified status)
      // For simplicity here, we will log them out and redirect to login, encouraging verification.
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
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      router.push('/login');
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    setLoading(true);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: "If an account exists, a reset link has been sent." });
    } catch (error: any) {
      console.error("Password reset email error:", error);
      toast({ title: "Error Sending Reset Email", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const confirmPasswordReset = async (code: string, newPassword: string) => {
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
        confirmPasswordReset,
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
