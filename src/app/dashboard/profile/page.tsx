
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
  const [isLoading, setIsLoading] = useState(true); // Page-specific loading state

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true); // Show loader if auth state is still resolving
      return;
    }

    setIsLoading(true); // Start profile page specific loading/processing

    if (user && user.profile) { // user and user.profile are now guaranteed by useAuth if authenticated & verified
      // Populate the form state with data from user.profile (which is UserProfile type)
      const profileDataForForm: UserProfileType = {
        name: user.profile.name, // Directly from profile object
        email: user.email || user.profile.email, // Auth email primary, fallback to profile email (should be same)
        phone: user.profile.phone || "",
        avatarUrl: user.profile.avatarUrl || user.photoURL, // Profile avatar primary, fallback to auth photoURL
        preferences: {
          defaultVehiclePlate: user.profile.preferences?.defaultVehiclePlate || "",
          requireCovered: user.profile.preferences?.requireCovered || false,
          requireEVCharging: user.profile.preferences?.requireEVCharging || false,
        },
        createdAt: user.profile.createdAt, // Might be undefined if default-constructed in useAuth
        updatedAt: user.profile.updatedAt, // Might be undefined if default-constructed in useAuth
      };
      setUserProfileForForm(profileDataForForm);

      // Heuristic to check if it's a "new" or "incomplete" profile.
      // If `user.profile.createdAt` is undefined, it implies this profile was default-constructed in useAuth
      // because the Firestore document didn't exist when onAuthStateChanged first ran.
      if (!user.profile.createdAt && !user.profile.updatedAt) {
        toast({
          title: "Welcome! Complete Your Profile",
          description: "Please fill in your details to personalize your experience.",
        });
      }
    } else {
      // Not authenticated, or user object/profile is not as expected after authLoading is false.
      // DashboardLayout should handle redirection if not authenticated.
      // Setting userProfileForForm to null will trigger the "Could not load" message if not redirected.
      setUserProfileForForm(null);
    }
    setIsLoading(false); // End profile page specific loading
  }, [user, authLoading]);

  const handleProfileUpdate = async (data: Partial<UserProfileType>) => {
    if (!user?.uid || !userProfileForForm) return;

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
      // user state in useAuth will be updated, triggering re-render of this page
      // with the new user.profile data via the useEffect.
    } catch (error) {
      console.error("Failed to update profile from ProfilePage:", error);
      // Toast is handled in updateUserProfileData in useAuth
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
    // This message is shown if user is not authenticated/verified (user is null from useAuth),
    // or if userProfileForForm was explicitly set to null in the useEffect.
    return <p>Could not load user profile. Ensure you are logged in and your email is verified.</p>;
  }

  return (
    <div>
      <PageTitle title="My Profile" description="View and update your personal information and parking preferences." />
      <UserProfileForm userProfile={userProfileForForm} onSubmit={handleProfileUpdate} />
    </div>
  );
}
