
"use client";

import Link from 'next/link';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AppLogo } from '@/components/core/AppLogo';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters." })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter."})
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter."})
    .regex(/[0-9]/, { message: "Password must contain at least one number."}),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordPageComponent() {
  const { confirmPasswordReset, loading: authLoading } = useAuth();
  const [formSubmitting, setFormSubmitting] = useState(false); // Renamed from loading
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('oobCode'); // Firebase uses 'oobCode' for password reset tokens

  useEffect(() => {
    if (!token && !message) { 
      setMessage({ type: 'error', text: 'Invalid or missing password reset token. Please request a new one.' });
    }
  }, [token, message, router]);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) {
      setMessage({ type: 'error', text: "Invalid reset token. Please try the reset process again." });
      return;
    }
    setFormSubmitting(true);
    setMessage(null);
    try {
      await confirmPasswordReset(token, values.newPassword);
      // Toast and redirection handled by useAuth's confirmPasswordReset
      setMessage({ type: 'success', text: 'Your password has been reset successfully! Redirecting to login...' });
      form.reset();
      // setTimeout(() => router.push('/login'), 3000); // Redirection now in useAuth
    } catch (error: any) {
      // Error already handled by toast in useAuth
      setMessage({ type: 'error', text: error.message || "Failed to reset password. The link may be invalid or expired." });
      console.error("Reset password submit error:", error);
    } finally {
      setFormSubmitting(false);
    }
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-primary/10">
      <div className="mb-8">
        <AppLogo textSize="text-3xl" iconSize={36}/>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Create a new strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`mb-4 p-3 rounded-md text-sm flex items-center ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {message.type === 'success' ? <CheckCircle className="mr-2 h-5 w-5" /> : <AlertTriangle className="mr-2 h-5 w-5" />}
              {message.text}
            </div>
          )}

          {!message?.text.includes("successfully") && token && ( 
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={formSubmitting || authLoading || !token}>
                  {formSubmitting || authLoading ? "Resetting Password..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ResetPasswordPageComponent />
    </Suspense>
  );
}
