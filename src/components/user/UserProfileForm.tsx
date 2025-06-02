
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { UserProfile as UserProfileType } from '@/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { UploadCloud, Edit2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email(),
  phone: z.string().optional().refine(val => !val || /^[+]?[0-9]{10,15}$/.test(val), {
    message: "Invalid phone number format.",
  }),
  avatarUrl: z.string().optional().or(z.literal("")).or(z.null()), 
  
  defaultVehiclePlate: z.string().optional().nullable().refine(val => !val || /^[A-Z0-9\s-]{3,10}$/i.test(val), {
    message: "Invalid vehicle plate format (3-10 alphanumeric chars, spaces, hyphens)."
  }),
  defaultVehicleMake: z.string().optional().nullable(),
  defaultVehicleModel: z.string().optional().nullable(),
  defaultVehicleColor: z.string().optional().nullable(),

  requireCovered: z.boolean().optional(),
  requireEVCharging: z.boolean().optional(),

  communicationBookingEmails: z.boolean().optional(),
  communicationPromotionalEmails: z.boolean().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileFormProps {
  userProfile: UserProfileType;
  onSubmit: (data: Partial<UserProfileType>) => Promise<void>;
}

export function UserProfileForm({ userProfile, onSubmit: handleFormSubmit }: UserProfileFormProps) {
  const { loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: userProfile.name || "",
      email: userProfile.email || "",
      phone: userProfile.phone || "",
      avatarUrl: userProfile.avatarUrl || "",
      defaultVehiclePlate: userProfile.preferences?.defaultVehiclePlate || null,
      defaultVehicleMake: userProfile.preferences?.defaultVehicleMake || null,
      defaultVehicleModel: userProfile.preferences?.defaultVehicleModel || null,
      defaultVehicleColor: userProfile.preferences?.defaultVehicleColor || null,
      requireCovered: userProfile.preferences?.requireCovered || false,
      requireEVCharging: userProfile.preferences?.requireEVCharging || false,
      communicationBookingEmails: userProfile.preferences?.communication?.bookingEmails !== undefined ? userProfile.preferences.communication.bookingEmails : true,
      communicationPromotionalEmails: userProfile.preferences?.communication?.promotionalEmails || false,
    },
  });

  useEffect(() => {
    form.reset({
      name: userProfile.name || "",
      email: userProfile.email || "",
      phone: userProfile.phone || "",
      avatarUrl: userProfile.avatarUrl || "",
      defaultVehiclePlate: userProfile.preferences?.defaultVehiclePlate || null,
      defaultVehicleMake: userProfile.preferences?.defaultVehicleMake || null,
      defaultVehicleModel: userProfile.preferences?.defaultVehicleModel || null,
      defaultVehicleColor: userProfile.preferences?.defaultVehicleColor || null,
      requireCovered: userProfile.preferences?.requireCovered || false,
      requireEVCharging: userProfile.preferences?.requireEVCharging || false,
      communicationBookingEmails: userProfile.preferences?.communication?.bookingEmails !== undefined ? userProfile.preferences.communication.bookingEmails : true,
      communicationPromotionalEmails: userProfile.preferences?.communication?.promotionalEmails || false,
    });
  }, [userProfile, form]);


  async function processSubmit(values: ProfileFormValues) {
    setIsSaving(true);
    const submitData: Partial<UserProfileType> = {
        name: values.name,
        phone: values.phone || "", 
        avatarUrl: values.avatarUrl, 
        preferences: {
            // ...(userProfile.preferences || {}), // This line might cause issues if userProfile.preferences is undefined. Initialize properly.
            defaultVehiclePlate: values.defaultVehiclePlate || null,
            defaultVehicleMake: values.defaultVehicleMake || null,
            defaultVehicleModel: values.defaultVehicleModel || null,
            defaultVehicleColor: values.defaultVehicleColor || null,
            requireCovered: values.requireCovered || false,
            requireEVCharging: values.requireEVCharging || false,
            communication: {
                // ...(userProfile.preferences?.communication || {}),
                bookingEmails: values.communicationBookingEmails !== undefined ? values.communicationBookingEmails : true,
                promotionalEmails: values.communicationPromotionalEmails || false,
            }
        }
    };
    // Ensure preferences object exists if it was initially undefined
     if (!submitData.preferences && userProfile.preferences) {
        submitData.preferences = { ...userProfile.preferences };
     } else if (!submitData.preferences) {
        submitData.preferences = { communication: { bookingEmails: true, promotionalEmails: false }};
     }


    await handleFormSubmit(submitData);
    setIsSaving(false);
  }

  const currentAvatar = form.watch("avatarUrl") || userProfile.avatarUrl;
  const currentName = form.watch("name") || userProfile.name;

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "Image Too Large", description: "Please select an image smaller than 2MB.", variant: "destructive"});
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("avatarUrl", reader.result as string);
        form.trigger("avatarUrl"); // Trigger validation if needed
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details and avatar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => ( 
                <FormItem className="flex flex-col items-center text-center">
                  <div className="relative group">
                    <Avatar className="w-24 h-24 mb-2 ring-2 ring-primary ring-offset-2 ring-offset-background">
                      <AvatarImage src={currentAvatar || undefined} alt={currentName || "User Avatar"} data-ai-hint="user portrait" />
                      <AvatarFallback>{currentName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-background/80 group-hover:bg-primary/20"
                      onClick={() => fileInputRef.current?.click()}
                      title="Change profile picture"
                      disabled={isSaving}
                    >
                      <Edit2 className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
                    </Button>
                  </div>
                  <FormControl>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAvatarChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription className="text-xs mt-2">
                    Click the edit icon to choose an image (max 2MB).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Your full name" {...field} disabled={isSaving} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl><Input placeholder="your@email.com" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                  <FormDescription>Email address cannot be changed here.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl><Input type="tel" placeholder="+1 234 567 8900" {...field} value={field.value ?? ""} disabled={isSaving} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle &amp; Parking Preferences</CardTitle>
            <CardDescription>Set your default vehicle information and parking preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="defaultVehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Vehicle Plate (Optional)</FormLabel>
                  <FormControl><Input placeholder="XYZ 123" {...field} value={field.value ?? ""} disabled={isSaving} /></FormControl>
                  <FormDescription>Your most frequently used vehicle's number plate.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="defaultVehicleMake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Toyota" {...field} value={field.value ?? ""} disabled={isSaving}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultVehicleModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Camry" {...field} value={field.value ?? ""} disabled={isSaving}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultVehicleColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Blue" {...field} value={field.value ?? ""} disabled={isSaving}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="requireCovered"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Prefer Covered Parking?</FormLabel>
                    <FormDescription>Prioritize covered spots in search results.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireEVCharging"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Need EV Charging?</FormLabel>
                    <FormDescription>Only show spots with EV charging facilities.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} /></FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Communication Preferences</CardTitle>
            <CardDescription>Manage how we communicate with you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="communicationBookingEmails"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Booking Related Emails</FormLabel>
                    <FormDescription>Receive confirmations, reminders, and updates about your bookings.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="communicationPromotionalEmails"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Promotional Emails</FormLabel>
                    <FormDescription>Receive news, special offers, and updates from ParkSmart.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} /></FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={authLoading || isSaving || form.formState.isSubmitting} className="w-full md:w-auto">
          {(authLoading || isSaving || form.formState.isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {authLoading || isSaving || form.formState.isSubmitting ? "Saving Changes..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
