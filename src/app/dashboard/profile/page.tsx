
"use client";
import { useEffect, useState } from 'react';
import type { UserProfile as UserProfileType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { PageTitle } from '@/components/core/PageTitle';
import { UserProfileForm } from '@/components/user/UserProfileForm';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, loading: authLoading, updateUserProfileData } = useAuth();
  const [userProfileForForm, setUserProfileForForm] = useState<UserProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true); 
      return;
    }

    setIsLoading(true); 

    if (user && user.profile) { 
      const profileDataForForm: UserProfileType = {
        name: user.profile.name, 
        email: user.email || user.profile.email, 
        phone: user.profile.phone || "",
        avatarUrl: user.profile.avatarUrl || user.photoURL, 
        preferences: {
          defaultVehiclePlate: user.profile.preferences?.defaultVehiclePlate || "",
          defaultVehicleMake: user.profile.preferences?.defaultVehicleMake || "",
          defaultVehicleModel: user.profile.preferences?.defaultVehicleModel || "",
          defaultVehicleColor: user.profile.preferences?.defaultVehicleColor || "",
          requireCovered: user.profile.preferences?.requireCovered || false,
          requireEVCharging: user.profile.preferences?.requireEVCharging || false,
          communication: {
            bookingEmails: user.profile.preferences?.communication?.bookingEmails !== undefined ? user.profile.preferences.communication.bookingEmails : true,
            promotionalEmails: user.profile.preferences?.communication?.promotionalEmails || false,
          }
        },
        createdAt: user.profile.createdAt, 
        updatedAt: user.profile.updatedAt, 
      };
      setUserProfileForForm(profileDataForForm);

      if (!user.profile.createdAt && !user.profile.updatedAt) {
        toast({
          title: "Welcome! Complete Your Profile",
          description: "Please fill in your details to personalize your experience.",
        });
      }
    } else {
      setUserProfileForForm(null);
    }
    setIsLoading(false); 
  }, [user, authLoading]);

  const handleProfileUpdate = async (data: Partial<UserProfileType>) => { // Changed to Partial<UserProfileType>
    if (!user?.uid || !userProfileForForm) return;

    // The data from UserProfileForm is already structured as Partial<UserProfileType>
    // so we can pass it directly.
    try {
      await updateUserProfileData(user.uid, data);
    } catch (error) {
      console.error("Failed to update profile from ProfilePage:", error);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfileForForm) {
    return <p>Could not load user profile. Ensure you are logged in and your email is verified.</p>;
  }

  return (
    <div>
      <PageTitle title="My Profile" description="View and update your personal information and parking preferences." />
      <UserProfileForm userProfile={userProfileForForm} onSubmit={handleProfileUpdate} />
    </div>
  );
}
