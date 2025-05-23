
"use client";
import { useEffect, useState } from 'react';
import type { UserProfile as UserProfileType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { PageTitle } from '@/components/core/PageTitle';
import { UserProfileForm } from '@/components/user/UserProfileForm';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, loading: authLoading, updateUserProfileData, fetchUserProfileData } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.uid) {
        setIsLoading(true);
        try {
          const profileFromDb = await fetchUserProfileData(user);
          if (profileFromDb) {
            setUserProfile({
              ...profileFromDb, // Data from Firestore
              name: profileFromDb.name || user.displayName || user.email?.split('@')[0] || '',
              email: user.email || '', // Email from Firebase Auth is source of truth
              avatarUrl: profileFromDb.avatarUrl || user.photoURL || `https://placehold.co/150x150.png?text=${(profileFromDb.name || user.displayName || 'U').charAt(0)}`,
            });
          } else {
            // If no profile in DB yet (e.g., new user after email/pass signup but before profile form save)
            // Create a default one for the form
             setUserProfile({
                name: user.displayName || user.email?.split('@')[0] || '',
                email: user.email || '',
                avatarUrl: user.photoURL || `https://placehold.co/150x150.png?text=${(user.displayName || 'U').charAt(0)}`,
                preferences: {
                    defaultVehiclePlate: '',
                    requireCovered: false,
                    requireEVCharging: false,
                }
            });
            toast({title: "Complete Your Profile", description: "Please fill in your profile details."});
          }
        } catch (error) {
          console.error("Failed to fetch profile:", error);
          toast({title: "Error", description: "Could not load profile.", variant: "destructive"});
        } finally {
          setIsLoading(false);
        }
      } else if (!authLoading) { // If no user and auth is not loading, means not logged in or error
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [user, authLoading, fetchUserProfileData]);

  const handleProfileUpdate = async (data: Partial<UserProfileType>) => {
    if (!user?.uid || !userProfile) return;
    
    // Prepare data for Firestore, excluding email if you don't want it updatable there
    const firestoreData: Partial<UserProfileType> = {
        name: data.name,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        preferences: {
            defaultVehiclePlate: data.preferences?.defaultVehiclePlate,
            requireCovered: data.preferences?.requireCovered,
            requireEVCharging: data.preferences?.requireEVCharging,
        }
    };

    try {
      await updateUserProfileData(user.uid, firestoreData);
      // Optimistically update local state or re-fetch
      setUserProfile(current => ({
        ...(current as UserProfileType), // Cast current to UserProfileType
        ...data, // Apply changes
        email: user.email || '', // Ensure email from auth is preserved
      }));
      // toast({ title: "Profile Updated", description: "Your changes have been saved successfully." }); // toast is in useAuth now
    } catch (error) {
      console.error("Failed to update profile:", error);
      // toast({ title: "Update Failed", description: "Could not save profile changes. Please try again.", variant: "destructive" }); // toast is in useAuth now
      throw error; 
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) {
     // This might happen if user is not authenticated, dashboard layout should prevent this.
     // Or if profile fetching failed.
    return <p>Could not load user profile. Ensure you are logged in.</p>;
  }

  return (
    <div>
      <PageTitle title="My Profile" description="View and update your personal information and parking preferences." />
      <UserProfileForm userProfile={userProfile} onSubmit={handleProfileUpdate} />
    </div>
  );
}
