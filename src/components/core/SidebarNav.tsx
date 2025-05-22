"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookMarked, CreditCard, User, Star, Settings, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { AppLogo } from "./AppLogo";
import { Separator } from "@/components/ui/separator";

const mainNavItems = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/bookings", label: "My Bookings", icon: BookMarked },
  { href: "/dashboard/favorites", label: "Favorite Locations", icon: Star },
  { href: "/search", label: "Find Parking", icon: Search },
];

const userNavItems = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/payment-methods", label: "Payment Methods", icon: CreditCard },
  // { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const renderNavItem = (item: typeof mainNavItems[0]) => (
    <Button
      key={item.label}
      variant={pathname === item.href ? "secondary" : "ghost"}
      className="w-full justify-start text-sm h-10"
      asChild
    >
      <Link href={item.href}>
        <item.icon className="mr-3 h-5 w-5 icon-glow" />
        {item.label}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground border-r">
      <div className="p-4 border-b">
        <AppLogo />
      </div>
      <div className="flex-grow p-3 space-y-1 overflow-y-auto">
        <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Menu</h3>
        {mainNavItems.map(renderNavItem)}
        
        <Separator className="my-3"/>

        <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</h3>
        {userNavItems.map(renderNavItem)}
      </div>
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-sm h-10"
          onClick={() => logout()}
        >
          <LogOut className="mr-3 h-5 w-5 icon-glow" />
          Logout
        </Button>
      </div>
    </div>
  );
}
