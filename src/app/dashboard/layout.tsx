
"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import { useAuth } from '@/hooks/useAuth';
import { SidebarNav } from '@/components/core/SidebarNav';
import { Header } from '@/components/core/Header'; 
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth(); // Removed user as it's not directly used here
  const router = useRouter();
  const pathname = usePathname(); // Get current path

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Pass current path as redirect query param
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect, 
    // but serves as a fallback or if component renders before redirect completes.
    // Returning null or a minimal loader avoids rendering dashboard content.
    return (
         <div className="flex h-screen items-center justify-center bg-background">
            <p>Redirecting to login...</p>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
       <Header /> {/* Main app header */}
      <div className="flex flex-1">
        <aside className="hidden md:block w-64 fixed top-16 left-0 h-[calc(100vh-4rem)] z-30">
          <SidebarNav />
        </aside>
        <main className="flex-1 md:ml-64 mt-16 p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
