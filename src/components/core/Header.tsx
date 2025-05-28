
import { AppLogo } from './AppLogo';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, AlignJustify, LogIn, UserPlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import { useAuth } from '@/hooks/useAuth';


const NavLink = ({ href, children, icon: Icon }: { href: string, children: React.ReactNode, icon?: React.ElementType }) => (
  <SheetClose asChild>
    <Link 
        href={href} 
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-primary/10"
    >
      {Icon && <Icon className="h-5 w-5 icon-glow" />}
      {children}
    </Link>
  </SheetClose>
);

export function Header() {
  const { isAuthenticated, user } = useAuth();
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
          {isAuthenticated && (
            <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
                Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <AlignJustify className="h-5 w-5 icon-glow" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] pt-10 pr-0">
                <nav className="grid gap-2 text-lg font-medium p-4">
                  <SheetClose asChild><AppLogo className="mb-4" /></SheetClose>
                  <NavLink href="/search" icon={Search}>Find Parking</NavLink>
                  {isAuthenticated && <NavLink href="/dashboard" icon={require('lucide-react').LayoutDashboard}>Dashboard</NavLink>}
                  <NavLink href="/#how-it-works" icon={require('lucide-react').Zap}>How It Works</NavLink>
                  <NavLink href="/features" icon={require('lucide-react').Settings}>Features</NavLink>
                  {!isAuthenticated && (
                    <>
                        <hr className="my-2" />
                        <NavLink href="/login" icon={LogIn}>Login</NavLink>
                        <NavLink href="/signup" icon={UserPlus}>Sign Up</NavLink>
                    </>
                  )}
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
