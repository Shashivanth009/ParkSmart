"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SidebarNav } from '@/components/core/SidebarNav';
import { Header } from '@/components/core/Header'; // Using the main header for consistency
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect, but serves as a fallback.
    return null; 
  }

  return (
    <div className="flex min-h-screen flex-col">
       <Header /> {/* Main app header */}
      <div className="flex flex-1">
        <aside className="hidden md:block w-64 fixed top-16 left-0 h-[calc(100vh-4rem)] z-30">
           {/* Adjust top to account for header height */}
          <SidebarNav />
        </aside>
        <main className="flex-1 md:ml-64 mt-16 p-4 md:p-8 bg-background">
          {/* Adjust mt for header, ml for sidebar */}
          {children}
        </main>
      </div>
      {/* Mobile navigation can be added here using a Sheet component if needed */}
    </div>
  );
}
