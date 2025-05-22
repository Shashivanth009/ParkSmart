"use client";
import { useEffect, useState } from 'react';
import type { UserProfile as UserProfileType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { PageTitle } from '@/components/core/PageTitle';
import { UserProfileForm } from '@/components/user/UserProfileForm';
import { Loader2 } from 'lucide-react';

// Mock profile data fetch
async function fetchUserProfile(userId: string): Promise<UserProfileType> {
  console.log("Fetching profile for user:", userId);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
  return {
    name: 'Demo User',
    email: 'demo@example.com',
    phone: '+11234567890',
    avatarUrl: 'https://placehold.co/150x150.png',
    preferences: {
      defaultVehiclePlate: 'XYZ 123',
      requireCovered: true,
      requireEVCharging: false,
    }
  };
}

// Mock profile data update
async function updateUserProfile(userId: string, data: Partial<UserProfileType>): Promise<UserProfileType> {
  console.log("Updating profile for user:", userId, "with data:", data);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
  // In a real app, this would merge existing profile with new data
  const updatedProfile = {
    name: data.name || 'Demo User',
    email: data.email || 'demo@example.com', // Email shouldn't really be updatable like this
    phone: data.phone,
    avatarUrl: data.avatarUrl,
    preferences: {
      defaultVehiclePlate: data.preferences?.defaultVehiclePlate,
      requireCovered: data.preferences?.requireCovered,
      requireEVCharging: data.preferences?.requireEVCharging,
    }
  };
  return updatedProfile as UserProfileType;
}


export default function ProfilePage() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile(user.id)
        .then(profile => {
          // Merge fetched profile with auth user info, auth user email is source of truth
          setUserProfile({...profile, email: user.email, name: user.name, avatarUrl: user.avatarUrl || profile.avatarUrl });
          setIsLoading(false);
        })
        .catch(error => {
          console.error("Failed to fetch profile:", error);
          setIsLoading(false);
          // Handle error (e.g., show error message)
        });
    }
  }, [user]);

  const handleProfileUpdate = async (data: Partial<UserProfileType>) => {
    if (!user?.id || !userProfile) return;
    setIsLoading(true); // Indicate saving
    try {
      const updatedData = await updateUserProfile(user.id, data);
      setUserProfile(current => ({...current, ...updatedData, email: user.email, name: data.name || current!.name, avatarUrl: data.avatarUrl || current!.avatarUrl })); // Ensure email from auth is preserved
    } catch (error) {
      console.error("Failed to update profile:", error);
      // Handle error (e.g., show error toast)
      throw error; // re-throw for UserProfileForm to catch
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !userProfile) { // Show loader only on initial load
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) {
    return <p>Could not load user profile.</p>;
  }

  return (
    <div>
      <PageTitle title="My Profile" description="View and update your personal information and parking preferences." />
      <UserProfileForm userProfile={userProfile} onSubmit={handleProfileUpdate} />
    </div>
  );
}
