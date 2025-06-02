
"use client";
import { useAuth } from '@/hooks/useAuth';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookMarked, Star, User, MapPin, Clock, AlertTriangle, MoreHorizontal, Loader2 } from 'lucide-react';
import type { Booking, FavoriteLocation } from '@/types';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

// Mock Data
const mockBookings: Booking[] = [
  { id: 'b1', spaceId: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', startTime: new Date(Date.now() + 3600000 * 2).toISOString(), endTime: new Date(Date.now() + 3600000 * 4).toISOString(), totalCost: 7.50, status: 'upcoming', vehiclePlate: 'UPC 001' },
  { id: 'b2', spaceId: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Metropolis', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), totalCost: 9.00, status: 'active', vehiclePlate: 'ACT 123' },
  { id: 'b3', spaceId: 'ps_historic1', facilityName: 'Airport Long Term', facilityAddress: '789 Pine Ln, Gotham',startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString(), totalCost: 3.60, status: 'completed', vehiclePlate: 'CMP 789' },
];

const mockFavorites: FavoriteLocation[] = [
  { id: 'f1', name: 'Work Parking', address: '1 Business Rd', spaceId: 'ps_work_fav' },
  { id: 'f2', name: 'Gym Spot', address: '10 Fitness Ave', spaceId: 'ps_gym_fav' },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [upcomingAndActiveBookings, setUpcomingAndActiveBookings] = useState<Booking[]>([]);
  const [recentFavorites, setRecentFavorites] = useState<FavoriteLocation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    setDataLoading(true);
    setTimeout(() => {
        setUpcomingAndActiveBookings(mockBookings.filter(b => b.status === 'upcoming' || b.status === 'active').slice(0, 2));
        setRecentFavorites(mockFavorites.slice(0, 2));
        setDataLoading(false);
    }, 700);
  }, []);

  if (authLoading || !user) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  const greeterName =
    user.profile?.name ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : "") || 
    "User";
  const firstName = greeterName.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageTitle title={`Welcome back, ${firstName}!`} description="Here's a quick overview of your parking activity." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active/Upcoming Bookings</CardTitle>
            <BookMarked className="h-5 w-5 text-primary icon-glow-primary" />
          </CardHeader>
          <CardContent>
            {dataLoading ? <Loader2 className="h-6 w-6 animate-spin my-2"/> : <div className="text-2xl font-bold">{upcomingAndActiveBookings.length}</div> }
            <p className="text-xs text-muted-foreground">
              {upcomingAndActiveBookings.find(b => b.status === 'active') ? 'At least 1 currently active' : 'No active bookings now'}
            </p>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/bookings">View All Bookings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Locations</CardTitle>
            <Star className="h-5 w-5 text-accent icon-glow" />
          </CardHeader>
          <CardContent>
             {dataLoading ? <Loader2 className="h-6 w-6 animate-spin my-2"/> : <div className="text-2xl font-bold">{mockFavorites.length}</div> }
            <p className="text-xs text-muted-foreground">
              Quick access to your saved spots.
            </p>
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/favorites">Manage Favorites</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            <User className="h-5 w-5 text-muted-foreground icon-glow-primary" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">Verified</div>
             <p className="text-xs text-muted-foreground">Profile and payment methods up to date.</p>
             <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <Link href="/dashboard/profile">View Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {dataLoading && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
      
      {!dataLoading && upcomingAndActiveBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Next Bookings</h2>
          <div className="space-y-4">
            {upcomingAndActiveBookings.map(booking => (
              <Card key={booking.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{booking.facilityName}</CardTitle>
                  <CardDescription className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> {booking.facilityAddress}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> From: {format(new Date(booking.startTime), "PPpp")}</p>
                  <p className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> To: {format(new Date(booking.endTime), "PPpp")}</p>
                  <p>Status: <span className={`font-medium ${booking.status === 'active' ? 'text-yellow-400' : 'text-blue-400'}`}>{booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></p>
                </CardContent>
                <CardFooter>
                  <Button variant="default" asChild>
                    <Link href={`/manage-parking/${booking.id}`}>
                        <MoreHorizontal className="mr-2 h-4 w-4"/> Manage Booking
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {!dataLoading && upcomingAndActiveBookings.length === 0 && (
         <Card className="shadow-md">
            <CardContent className="p-6 flex flex-col items-center text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No Upcoming or Active Bookings</h3>
                <p className="text-sm text-muted-foreground mb-4">Ready to park? Find your next spot easily.</p>
                <Button asChild><Link href="/search">Find Parking Now</Link></Button>
            </CardContent>
         </Card>
      )}


      {!dataLoading && recentFavorites.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 mt-8">Quick Access Favorites</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentFavorites.map(fav => (
              <Card key={fav.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Star className="w-5 h-5 mr-2 text-accent icon-glow" />{fav.name}
                  </CardTitle>
                  <CardDescription className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> {fav.address}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="secondary" asChild>
                    <Link href={fav.spaceId ? `/booking/${fav.spaceId}` : `/search?location=${encodeURIComponent(fav.address)}`}>
                      Book From Favorite
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
