
"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SidebarNav } from '@/components/core/SidebarNav';
import { Header } from '@/components/core/Header'; 
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
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
    // This case is primarily for the brief moment before redirect happens or if JS is disabled.
    // The useEffect hook handles the main redirection logic.
    return (
         <div className="flex h-screen items-center justify-center bg-background">
            <p>Redirecting to login...</p>
            <Loader2 className="ml-2 h-5 w-5 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
       <Header />
      <div className="flex flex-1">
        <aside className="hidden md:block w-64 fixed top-16 left-0 h-[calc(100vh-4rem)] z-30 border-r">
          <SidebarNav />
        </aside>
        <main className="flex-1 md:ml-64 mt-16 p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
