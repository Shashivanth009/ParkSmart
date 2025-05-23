
import { AppLogo } from './AppLogo';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, AlignJustify } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import { useAuth } from '@/hooks/useAuth';


const NavLink = ({ href, children }: { href: string, children: React.ReactNode }) => (
  <SheetClose asChild>
    <Link href={href} className="block py-2 text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </Link>
  </SheetClose>
);

export function Header() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        <AppLogo />
        
        {/* Desktop Navigation */}
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
          {isAuthenticated && (
            <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
                Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
           {/* Mobile Navigation Trigger - Moved before AuthButtons for better layout on small screens */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <AlignJustify className="h-5 w-5 icon-glow" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] pt-10">
                <nav className="flex flex-col gap-3 px-4">
                  <NavLink href="/search">Find Parking</NavLink>
                  <NavLink href="/#how-it-works">How It Works</NavLink>
                  <NavLink href="/features">Features</NavLink>
                  {isAuthenticated && <NavLink href="/dashboard">Dashboard</NavLink>}
                  {/* Add more mobile links if needed, e.g. Profile, Sign Out from AuthButtons */}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
