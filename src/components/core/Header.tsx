
import { AppLogo } from './AppLogo';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        <AppLogo />
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium">
          <Link href="/search" className="text-muted-foreground transition-colors hover:text-foreground">
            Find Parking
          </Link>
          <Link href="/#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">
            How It Works
          </Link>
          <Link href="/features" className="text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link href="/search">
              <Search className="h-5 w-5 icon-glow" />
              <span className="sr-only">Search</span>
            </Link>
          </Button>
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}

    