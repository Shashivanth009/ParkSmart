
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
import { MapPin, CalendarDays, Clock, Car, CircleDollarSign, Ban, CheckCircle2, AlertTriangle, MoreHorizontal, Loader2 } from 'lucide-react';

const mockBookings: Booking[] = [
  { id: 'b1', spaceId: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', startTime: new Date(Date.now() + 3600000 * 2).toISOString(), endTime: new Date(Date.now() + 3600000 * 4).toISOString(), totalCost: 7.50, status: 'upcoming', vehiclePlate: 'UPC 001' },
  { id: 'b2', spaceId: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Metropolis', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000 * 1).toISOString(), totalCost: 9.00, status: 'active', vehiclePlate: 'ACT 123' },
  { id: 'b3', spaceId: 'ps_historic1', facilityName: 'Airport Long Term', facilityAddress: '789 Pine Ln, Gotham', startTime: new Date(Date.now() - 86400000 * 2).toISOString(), endTime: new Date(Date.now() - 86400000 * 2 + 3600000 * 3).toISOString(), totalCost: 12.00, status: 'completed', vehiclePlate: 'CMP 789' },
  { id: 'b4', spaceId: 'ps_historic2', facilityName: 'Mall Parking Lot', facilityAddress: '101 Shopping Blvd, Star City', startTime: new Date(Date.now() - 86400000 * 5).toISOString(), endTime: new Date(Date.now() - 86400000 * 5 + 3600000 * 1).toISOString(), totalCost: 2.00, status: 'cancelled', vehiclePlate: 'CAN 456' },
  { id: 'b5', spaceId: 'ps_upcoming_beach', facilityName: 'Beachside Parking', facilityAddress: '2 Seaside Ave, Coast City', startTime: new Date(Date.now() + 86400000 * 1).toISOString(), endTime: new Date(Date.now() + 86400000 * 1 + 3600000 * 5).toISOString(), totalCost: 25.00, status: 'upcoming', vehiclePlate: 'SEA 246' },
  // Add more bookings to test states thoroughly
  { id: 'bk_active1', spaceId: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', startTime: new Date(Date.now() - 3600000 * 0.5).toISOString(), endTime: new Date(Date.now() + 3600000 * 1.5).toISOString(), totalCost: 6.25, status: 'active', vehiclePlate: 'ACT 001' },
  { id: 'bk_upcoming1', spaceId: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Metropolis', startTime: new Date(Date.now() + 3600000 * 24).toISOString(), endTime: new Date(Date.now() + 3600000 * 26).toISOString(), totalCost: 6.00, status: 'upcoming', vehiclePlate: 'UPC 002' },
];

const BookingStatusBadge = ({ status }: { status: Booking['status'] }) => {
  let VIcon = CheckCircle2; // Default for completed
  let color = "bg-green-500/20 text-green-400 border-green-500/30"; 
  let label = "Completed";

  if (status === 'upcoming') { VIcon = CalendarDays; color = "bg-blue-500/20 text-blue-400 border-blue-500/30"; label = "Upcoming"; }
  else if (status === 'active') { VIcon = Clock; color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; label = "Active"; }
  else if (status === 'cancelled') { VIcon = Ban; color = "bg-red-500/20 text-red-400 border-red-500/30"; label = "Cancelled"; }
  
  return (
    <Badge className={`${color} px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 shrink-0`}>
      <VIcon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
};

const BookingItemCard = ({ booking }: { booking: Booking }) => (
  <Card className="shadow-md hover:shadow-lg transition-shadow">
    <CardHeader>
      <div className="flex justify-between items-start gap-2">
        <div>
          <CardTitle className="text-lg">{booking.facilityName}</CardTitle>
          <CardDescription className="flex items-center text-sm mt-1">
            <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow flex-shrink-0" /> {booking.facilityAddress}
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
      {(booking.status === 'upcoming' || booking.status === 'active') && (
        <Button size="sm" asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/manage-parking?bookingId=${booking.id}`}>
                <MoreHorizontal className="mr-2 h-4 w-4"/> Manage
            </Link>
        </Button>
      )}
      {(booking.status === 'completed' || booking.status === 'cancelled') && (
        <Button variant="outline" size="sm" asChild>
            <Link href={`/booking/${booking.spaceId}?rebook=true`}>Book Again</Link>
        </Button>
      )}
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

  const filteredBookings = (statusFilter: Booking['status'] | 'all' | 'history') => {
    if (statusFilter === 'all') return bookings;
    if (statusFilter === 'history') return bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
    return bookings.filter(b => b.status === statusFilter);
  };
  
  const tabContent = (statusFilter: Booking['status'] | 'all' | 'history', title: string) => {
    const currentBookings = filteredBookings(statusFilter);
    if (isLoading) return <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>;
    if (currentBookings.length === 0) {
         return (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-lg shadow p-6">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-gray-500" />
                <p className="text-lg font-medium text-foreground">No {title.toLowerCase()} bookings found.</p>
                <p className="text-sm mb-4">Looks like there's nothing here yet!</p>
                {(statusFilter === 'all' || statusFilter === 'upcoming' || statusFilter === 'active') && (
                    <Button asChild className="mt-2"><Link href="/search">Find Parking</Link></Button>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{tabContent('all', 'All')}</TabsContent>
        <TabsContent value="upcoming">{tabContent('upcoming', 'Upcoming')}</TabsContent>
        <TabsContent value="active">{tabContent('active', 'Active')}</TabsContent>
        <TabsContent value="history">{tabContent('history', 'Completed & Cancelled')}</TabsContent>
      </Tabs>
    </div>
  );
}
