"use client";

import Link from 'next/link';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/core/AppLogo';
import { ChromeIcon } from 'lucide-react'; // Using ChromeIcon as a generic browser/Google icon
import { toast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await login('email', values);
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error) {
      toast({ title: "Login Failed", description: "Invalid credentials. Please try again.", variant: "destructive" });
      console.error("Login error:", error);
    }
  }

  async function handleGoogleLogin() {
    try {
      await login('google');
      toast({ title: "Login Successful", description: "Welcome!" });
    } catch (error) {
      toast({ title: "Google Login Failed", description: "Could not sign in with Google. Please try again.", variant: "destructive" });
      console.error("Google login error:", error);
    }
  }
  
  if (isAuthenticated) {
    // Typically handled by useEffect redirect, but good for initial render too
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p>Redirecting to dashboard...</p>
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
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription>Sign in to access your ParkSmart account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
            <ChromeIcon className="mr-2 h-5 w-5 icon-glow" />
            Sign in with Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="/forgot-password" passHref>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                          Forgot password?
                        </Button>
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <p className="w-full">
            Don&apos;t have an account?{' '}
            <Link href="/#how-it-works" className="font-medium text-primary hover:underline">
              Learn More
            </Link>
            {/* In a real app, this might link to a signup page:
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign Up
            </Link> */}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
