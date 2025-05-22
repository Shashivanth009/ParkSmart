"use client";
import { useAuth } from '@/hooks/useAuth';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookMarked, Star, CreditCard, User, MapPin, Clock, AlertTriangle } from 'lucide-react';
import type { Booking, FavoriteLocation } from '@/types';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

// Mock Data
const mockBookings: Booking[] = [
  { id: 'b1', spaceId: 'ps1', spaceName: 'City Center Parking', spaceAddress: '123 Main St', startTime: new Date(Date.now() + 3600000).toISOString(), endTime: new Date(Date.now() + 7200000).toISOString(), totalCost: 5.00, status: 'upcoming', vehiclePlate: 'XYZ 123' },
  { id: 'b2', spaceId: 'ps2', spaceName: 'Downtown Garage', spaceAddress: '456 Oak Ave', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), totalCost: 9.00, status: 'active', vehiclePlate: 'ABC 789' },
  { id: 'b3', spaceId: 'ps3', spaceName: 'Airport Long Term', spaceAddress: '789 Pine Ln',startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString(), totalCost: 3.60, status: 'completed', vehiclePlate: 'CAR 001' },
];

const mockFavorites: FavoriteLocation[] = [
  { id: 'f1', name: 'Work Parking', address: '1 Business Rd', spaceId: 'ps_work' },
  { id: 'f2', name: 'Gym Spot', address: '10 Fitness Ave', spaceId: 'ps_gym' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentFavorites, setRecentFavorites] = useState<FavoriteLocation[]>([]);

  useEffect(() => {
    // Simulate fetching data
    setUpcomingBookings(mockBookings.filter(b => b.status === 'upcoming' || b.status === 'active').slice(0, 2));
    setRecentFavorites(mockFavorites.slice(0, 2));
  }, []);

  if (!user) {
    return <p>Loading user data...</p>; // Or a loader component
  }

  return (
    <div className="space-y-8">
      <PageTitle title={`Welcome back, ${user.name.split(' ')[0]}!`} description="Here's a quick overview of your parking activity." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active/Upcoming Bookings</CardTitle>
            <BookMarked className="h-5 w-5 text-primary icon-glow-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingBookings.length}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingBookings.find(b => b.status === 'active') ? '1 currently active' : 'No active bookings'}
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
            <div className="text-2xl font-bold">{mockFavorites.length}</div>
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

      {upcomingBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Next Bookings</h2>
          <div className="space-y-4">
            {upcomingBookings.map(booking => (
              <Card key={booking.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{booking.spaceName}</CardTitle>
                  <CardDescription className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> {booking.spaceAddress}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> From: {format(new Date(booking.startTime), "PPpp")}</p>
                  <p className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> To: {format(new Date(booking.endTime), "PPpp")}</p>
                  <p>Status: <span className={`font-medium ${booking.status === 'active' ? 'text-green-400' : 'text-blue-400'}`}>{booking.status.toUpperCase()}</span></p>
                </CardContent>
                <CardFooter>
                  <Button variant="default" asChild>
                    <Link href={`/manage-parking/${booking.id}`}>Manage Booking</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {upcomingBookings.length === 0 && (
         <Card className="shadow-md">
            <CardContent className="p-6 flex flex-col items-center text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No Upcoming Bookings</h3>
                <p className="text-sm text-muted-foreground mb-4">Ready to park? Find your next spot easily.</p>
                <Button asChild><Link href="/search">Find Parking Now</Link></Button>
            </CardContent>
         </Card>
      )}


      {recentFavorites.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Access Favorites</h2>
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
                      Book Again
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
