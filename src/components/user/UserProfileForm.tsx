"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { UserProfile as UserProfileType } from '@/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { UploadCloud } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email(), // Email likely not editable, or needs special handling
  phone: z.string().optional().refine(val => !val || /^[+]?[0-9]{10,15}$/.test(val), {
    message: "Invalid phone number format.",
  }),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  defaultVehiclePlate: z.string().optional(),
  requireCovered: z.boolean().optional(),
  requireEVCharging: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileFormProps {
  userProfile: UserProfileType;
  onSubmit: (data: ProfileFormValues) => Promise<void>; // Simulate async submission
}

export function UserProfileForm({ userProfile, onSubmit: handleFormSubmit }: UserProfileFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: userProfile.name || "",
      email: userProfile.email || "", // Display only, not editable typically
      phone: userProfile.phone || "",
      avatarUrl: userProfile.avatarUrl || "",
      defaultVehiclePlate: userProfile.preferences?.defaultVehiclePlate || "",
      requireCovered: userProfile.preferences?.requireCovered || false,
      requireEVCharging: userProfile.preferences?.requireEVCharging || false,
    },
  });

  async function processSubmit(values: ProfileFormValues) {
    try {
      await handleFormSubmit(values);
      toast({ title: "Profile Updated", description: "Your changes have been saved successfully." });
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not save profile changes. Please try again.", variant: "destructive" });
    }
  }

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
                  <Avatar className="w-24 h-24 mb-2 ring-2 ring-primary ring-offset-2 ring-offset-background">
                    <AvatarImage src={field.value || userProfile.avatarUrl} alt={userProfile.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{userProfile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {/* Basic URL input for avatar. Real app would use file upload. */}
                  <FormControl>
                    <div className="flex items-center gap-2 w-full max-w-sm mx-auto">
                      <Input type="url" placeholder="Image URL for avatar" {...field} className="text-xs"/>
                      <Button type="button" variant="outline" size="icon" className="shrink-0">
                        <UploadCloud className="h-4 w-4"/>
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">Enter a URL for your new avatar image.</FormDescription>
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
                  <FormControl><Input placeholder="Your full name" {...field} /></FormControl>
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
                  <FormControl><Input type="tel" placeholder="+1 234 567 8900" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parking Preferences</CardTitle>
            <CardDescription>Set your default parking preferences for faster bookings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="defaultVehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Vehicle Plate (Optional)</FormLabel>
                  <FormControl><Input placeholder="XYZ 123" {...field} /></FormControl>
                  <FormDescription>Enter your most frequently used vehicle's number plate.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireCovered"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Prefer Covered Parking?</FormLabel>
                    <FormDescription>Prioritize covered spots in search results.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
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
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full md:w-auto">
          {form.formState.isSubmitting ? "Saving Changes..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
