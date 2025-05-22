"use client";
import { useEffect, useState } from 'react';
import type { Booking } from '@/types';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { format } from 'date-fns';
import { MapPin, CalendarDays, Clock, Car, CircleDollarSign, Ban, CheckCircle2, AlertTriangle } from 'lucide-react';

const mockBookings: Booking[] = [
  { id: 'b1', spaceId: 'ps1', spaceName: 'City Center Parking', spaceAddress: '123 Main St, Anytown', startTime: new Date(Date.now() + 3600000 * 2).toISOString(), endTime: new Date(Date.now() + 3600000 * 4).toISOString(), totalCost: 7.50, status: 'upcoming', vehiclePlate: 'UPC 001' },
  { id: 'b2', spaceId: 'ps2', spaceName: 'Downtown Garage', spaceAddress: '456 Oak Ave, Metropolis', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000 * 1).toISOString(), totalCost: 9.00, status: 'active', vehiclePlate: 'ACT 123' },
  { id: 'b3', spaceId: 'ps3', spaceName: 'Airport Long Term', spaceAddress: '789 Pine Ln, Gotham', startTime: new Date(Date.now() - 86400000 * 2).toISOString(), endTime: new Date(Date.now() - 86400000 * 2 + 3600000 * 3).toISOString(), totalCost: 12.00, status: 'completed', vehiclePlate: 'CMP 789' },
  { id: 'b4', spaceId: 'ps4', spaceName: 'Mall Parking Lot', spaceAddress: '101 Shopping Blvd, Star City', startTime: new Date(Date.now() - 86400000 * 5).toISOString(), endTime: new Date(Date.now() - 86400000 * 5 + 3600000 * 1).toISOString(), totalCost: 2.00, status: 'cancelled', vehiclePlate: 'CAN 456' },
  { id: 'b5', spaceId: 'ps5', spaceName: 'Beachside Parking', spaceAddress: '2 Seaside Ave, Coast City', startTime: new Date(Date.now() + 86400000 * 1).toISOString(), endTime: new Date(Date.now() + 86400000 * 1 + 3600000 * 5).toISOString(), totalCost: 25.00, status: 'upcoming', vehiclePlate: 'SEA 246' },
];

const BookingStatusBadge = ({ status }: { status: Booking['status'] }) => {
  let VIcon = CheckCircle2;
  let color = "bg-green-500/20 text-green-400 border-green-500/30";
  if (status === 'upcoming') { VIcon = CalendarDays; color = "bg-blue-500/20 text-blue-400 border-blue-500/30"; }
  else if (status === 'active') { VIcon = Clock; color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; }
  else if (status === 'cancelled') { VIcon = Ban; color = "bg-red-500/20 text-red-400 border-red-500/30"; }
  
  return (
    <Badge className={`${color} px-2.5 py-1 text-xs font-medium flex items-center gap-1.5`}>
      <VIcon className="h-3.5 w-3.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const BookingItemCard = ({ booking }: { booking: Booking }) => (
  <Card className="shadow-md hover:shadow-lg transition-shadow">
    <CardHeader>
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="text-lg">{booking.spaceName}</CardTitle>
          <CardDescription className="flex items-center text-sm mt-1">
            <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow" /> {booking.spaceAddress}
          </CardDescription>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>
    </CardHeader>
    <CardContent className="text-sm space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <p className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-muted-foreground icon-glow" /> <strong>Date:</strong> {format(new Date(booking.startTime), "MMM d, yyyy")}</p>
        <p className="flex items-center"><Clock className="w-4 h-4 mr-2 text-muted-foreground icon-glow" /> <strong>Time:</strong> {format(new Date(booking.startTime), "p")} - {format(new Date(booking.endTime), "p")}</p>
        {booking.vehiclePlate && <p className="flex items-center"><Car className="w-4 h-4 mr-2 text-muted-foreground icon-glow" /> <strong>Vehicle:</strong> {booking.vehiclePlate}</p>}
        <p className="flex items-center"><CircleDollarSign className="w-4 h-4 mr-2 text-muted-foreground icon-glow" /> <strong>Cost:</strong> ${booking.totalCost.toFixed(2)}</p>
      </div>
    </CardContent>
    <CardFooter className="flex justify-end gap-2">
      {booking.status === 'upcoming' && <Button variant="outline" size="sm" asChild><Link href={`/manage-parking/${booking.id}`}>Manage</Link></Button>}
      {booking.status === 'active' && <Button size="sm" asChild><Link href={`/manage-parking/${booking.id}`}>View Active Session</Link></Button>}
      {(booking.status === 'completed' || booking.status === 'cancelled') && <Button variant="ghost" size="sm" asChild><Link href={`/booking/${booking.spaceId}?rebook=true`}>Book Again</Link></Button>}
    </CardFooter>
  </Card>
);


export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setBookings(mockBookings.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setIsLoading(false);
    }, 1000);
  }, []);

  const filteredBookings = (status: Booking['status'] | 'all') => {
    if (status === 'all') return bookings;
    return bookings.filter(b => b.status === status);
  };
  
  const tabContent = (status: Booking['status'] | 'all', title: string) => {
    const currentBookings = filteredBookings(status);
    if (isLoading) return <p className="text-center py-8">Loading bookings...</p>;
    if (currentBookings.length === 0) {
         return (
            <div className="text-center py-10 text-muted-foreground">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-gray-500" />
                <p className="text-lg font-medium">No {title.toLowerCase()} bookings found.</p>
                <p className="text-sm">Looks like there's nothing here yet!</p>
                {status !== 'completed' && status !== 'cancelled' && (
                    <Button asChild className="mt-4"><Link href="/search">Find Parking</Link></Button>
                )}
            </div>
        );
    }
    return (
        <div className="space-y-4 mt-4">
            {currentBookings.map(booking => <BookingItemCard key={booking.id} booking={booking} />)}
        </div>
    );
  }


  return (
    <div>
      <PageTitle title="My Bookings" description="View and manage your past, current, and upcoming parking reservations." />
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">History</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{tabContent('all', 'All')}</TabsContent>
        <TabsContent value="upcoming">{tabContent('upcoming', 'Upcoming')}</TabsContent>
        <TabsContent value="active">{tabContent('active', 'Active')}</TabsContent>
        <TabsContent value="completed">{tabContent('completed', 'Completed & Cancelled')}</TabsContent>
      </Tabs>
    </div>
  );
}
