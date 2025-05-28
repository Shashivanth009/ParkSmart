
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
      if (user?.uid) { // User from useAuth hook is already enriched or being enriched
        setIsLoading(true);
        if (user.profile) { // If profile already loaded via useAuth
           setUserProfile({
            ...user.profile,
            name: user.profile.name || user.displayName || user.email?.split('@')[0] || '',
            email: user.email || '',
            avatarUrl: user.profile.avatarUrl || user.photoURL || `https://placehold.co/150x150.png?text=${(user.profile.name || user.displayName || 'U').charAt(0)}`,
          });
        } else { // Fallback if profile somehow not on user object yet, try fetching
          const profileFromDb = await fetchUserProfileData(user);
          if (profileFromDb) {
            setUserProfile({
              ...profileFromDb,
              name: profileFromDb.name || user.displayName || user.email?.split('@')[0] || '',
              email: user.email || '',
              avatarUrl: profileFromDb.avatarUrl || user.photoURL || `https://placehold.co/150x150.png?text=${(profileFromDb.name || user.displayName || 'U').charAt(0)}`,
            });
          } else {
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
        }
        setIsLoading(false);
      } else if (!authLoading) { 
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [user, authLoading, fetchUserProfileData]);

  const handleProfileUpdate = async (data: Partial<UserProfileType>) => {
    if (!user?.uid || !userProfile) return;
    
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
      // user state in useAuth will be updated, causing re-render
    } catch (error) {
      console.error("Failed to update profile:", error);
      // Toast is handled in updateUserProfileData
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
    return <p>Could not load user profile. Ensure you are logged in and your email is verified.</p>;
  }

  return (
    <div>
      <PageTitle title="My Profile" description="View and update your personal information and parking preferences." />
      <UserProfileForm userProfile={userProfile} onSubmit={handleProfileUpdate} />
    </div>
  );
}
