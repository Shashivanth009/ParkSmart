import Link from 'next/link';
import { AppLogo } from './AppLogo';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border/40 bg-background/95">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <AppLogo textSize="text-xl" />
            <p className="mt-2 text-sm text-muted-foreground">
              Your smart solution for hassle-free parking.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Quick Links</h3>
            <ul className="space-y-1">
              <li><Link href="/search" className="text-sm text-muted-foreground hover:text-primary">Find Parking</Link></li>
              <li><Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">My Account</Link></li>
              <li><Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary">How It Works</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Legal</h3>
            <ul className="space-y-1">
              <li><Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
          &copy; {currentYear} ParkSmart. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
