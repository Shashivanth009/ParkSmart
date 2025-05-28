
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
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { sendPasswordResetEmail, loading: authLoading } = useAuth();
  const [formSubmitting, setFormSubmitting] = useState(false); // Renamed from loading to avoid conflict
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setFormSubmitting(true);
    try {
      await sendPasswordResetEmail(values.email);
      // Toast notification is handled within useAuth's sendPasswordResetEmail
      setSubmitted(true);
    } catch (error) {
      // Error is already handled by toast in useAuth
      console.error("Forgot password submit error:", error);
    } finally {
      setFormSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-primary/10">
        <div className="mb-8">
          <AppLogo textSize="text-3xl" iconSize={36}/>
        </div>
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset Link Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              If an account exists for the provided email, a password reset link has been sent. Please check your inbox (and spam folder).
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-primary/10">
      <div className="mb-8">
        <AppLogo textSize="text-3xl" iconSize={36}/>
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Your Password?</CardTitle>
          <CardDescription>No worries! Enter your email and we&apos;ll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={formSubmitting || authLoading}>
                {formSubmitting || authLoading ? "Sending Link..." : "Send Reset Link"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
