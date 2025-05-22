
"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Booking, ParkingSpace } from '@/types';
import { MapPin, CalendarDays, Clock, Car, CircleDollarSign, Navigation, Timer, Loader2, AlertTriangle, QrCode } from 'lucide-react';
import { format, differenceInMinutes, intervalToDuration } from 'date-fns';
import { ExtendParkingForm } from '@/components/booking/ExtendParkingForm';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Mock Data - replace with API calls
const fetchBookingAndSpaceDetails = async (bookingId: string): Promise<{ booking: Booking | null; space: ParkingSpace | null }> => {
  console.log("Fetching details for booking:", bookingId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockBookings: Booking[] = [
    { id: 'bk_active1', spaceId: 'ps1', spaceName: 'City Center Parking', spaceAddress: '123 Main St, Anytown', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000 * 2).toISOString(), totalCost: 7.50, status: 'active', vehiclePlate: 'ACT 001' },
    { id: 'bk_upcoming1', spaceId: 'ps2', spaceName: 'Downtown Garage', spaceAddress: '456 Oak Ave, Anytown', startTime: new Date(Date.now() + 3600000 * 1).toISOString(), endTime: new Date(Date.now() + 3600000 * 3).toISOString(), totalCost: 9.00, status: 'upcoming', vehiclePlate: 'UPC 002' },
  ];
  const mockSpaces: ParkingSpace[] = [
    { id: 'ps1', name: 'City Center Parking', address: '123 Main St, Anytown', availability: 'medium', pricePerHour: 2.5, features: ['covered', 'ev-charging'], coordinates: { lat: 0, lng: 0 } },
    { id: 'ps2', name: 'Downtown Garage', address: '456 Oak Ave, Anytown', availability: 'high', pricePerHour: 3.0, features: ['secure'], coordinates: { lat: 0, lng: 0 } },
  ];

  const booking = mockBookings.find(b => b.id === bookingId) || null;
  const space = booking ? mockSpaces.find(s => s.id === booking.spaceId) || null : null;
  
  return { booking, space };
};


export default function ManageParkingPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [space, setSpace] = useState<ParkingSpace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<Duration | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (bookingId) {
      fetchBookingAndSpaceDetails(bookingId)
        .then(data => {
          setBooking(data.booking);
          setSpace(data.space);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch booking/space details:", err);
          setIsLoading(false);
        });
    }
  }, [bookingId]);

  useEffect(() => {
    if (booking?.status === 'active' && booking.startTime && booking.endTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const startTime = new Date(booking.startTime);
        const endTime = new Date(booking.endTime);
        
        if (now > endTime) {
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
          setProgress(100);
          // Potentially update booking status to 'expired' or 'completed'
          clearInterval(timer);
          return;
        }
        
        const remaining = intervalToDuration({ start: now, end: endTime });
        setTimeRemaining(remaining);
        
        const totalDurationMinutes = differenceInMinutes(endTime, startTime);
        const elapsedMinutes = differenceInMinutes(now, startTime);
        const currentProgress = totalDurationMinutes > 0 ? Math.min(100, (elapsedMinutes / totalDurationMinutes) * 100) : 0;
        setProgress(currentProgress);

      }, 1000);
      return () => clearInterval(timer);
    } else if (booking?.status === 'upcoming' && booking.startTime) {
        const startTime = new Date(booking.startTime);
        const now = new Date();
        if (now < startTime) {
            setTimeRemaining(intervalToDuration({ start: now, end: startTime }));
        }
        setProgress(0);
    }
  }, [booking]);


  const handleExtendParking = async (newEndTime: Date, additionalCost: number, extendDuration: number) => {
    if (!booking || !space) return;
    console.log(`Extending booking ${booking.id} by ${extendDuration} hours. New end time: ${newEndTime}, Additional cost: $${additionalCost.toFixed(2)}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setBooking(prev => prev ? ({ ...prev, endTime: newEndTime.toISOString(), totalCost: prev.totalCost + additionalCost }) : null);
    toast({ title: "Parking Extended", description: `Your parking session now ends at ${format(newEndTime, "p")}.` });
  };

  const handleCancelBooking = async () => {
    if(!booking) return;
    // Simulate API Call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBooking(prev => prev ? ({...prev, status: 'cancelled'}) : null);
    toast({title: "Booking Cancelled", description: `Your booking for ${space?.name} has been cancelled.`});
  };


  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!booking || !space) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 text-center">
          <PageTitle title="Booking Not Found" description="The requested booking could not be found." />
          <Button onClick={() => router.push('/dashboard/bookings')}>View My Bookings</Button>
        </main>
        <Footer />
      </div>
    );
  }
  
  const isCancellable = booking.status === 'upcoming' && differenceInMinutes(new Date(booking.startTime), new Date()) > 60; // e.g. cancellable if more than 1hr away
  const canExtend = booking.status === 'active' || (booking.status === 'upcoming' && differenceInMinutes(new Date(booking.startTime), new Date()) < 60*2 ); // Can extend if active or upcoming soon
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title={booking.status === 'active' ? "Active Parking Session" : "Manage Your Booking"} />

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">{space.name}</CardTitle>
                <CardDescription className="flex items-center text-base pt-1">
                  <MapPin className="w-5 h-5 mr-2 text-muted-foreground icon-glow" /> {space.address}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <h4 className="text-md font-semibold">Booking Details (ID: {booking.id})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <p className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-primary icon-glow-primary" /> <strong>Date:</strong> {format(new Date(booking.startTime), "MMM d, yyyy")}</p>
                  <p className="flex items-center"><Clock className="w-4 h-4 mr-2 text-primary icon-glow-primary" /> <strong>Original Duration:</strong> {format(new Date(booking.startTime), "p")} - {format(new Date(booking.endTime), "p")}</p>
                  {booking.vehiclePlate && <p className="flex items-center"><Car className="w-4 h-4 mr-2 text-primary icon-glow-primary" /> <strong>Vehicle:</strong> {booking.vehiclePlate}</p>}
                  <p className="flex items-center"><CircleDollarSign className="w-4 h-4 mr-2 text-primary icon-glow-primary" /> <strong>Total Cost:</strong> ${booking.totalCost.toFixed(2)}</p>
                </div>
                
                {booking.status === 'active' && timeRemaining && (
                  <div className="pt-4">
                    <h4 className="text-md font-semibold mb-2">Time Remaining:</h4>
                    <div className="text-3xl font-bold text-primary mb-2 text-center">
                      {String(timeRemaining.hours || 0).padStart(2, '0')}:
                      {String(timeRemaining.minutes || 0).padStart(2, '0')}:
                      {String(timeRemaining.seconds || 0).padStart(2, '0')}
                    </div>
                    <Progress value={progress} className="w-full h-3" />
                  </div>
                )}
                {booking.status === 'upcoming' && timeRemaining && (
                    <div className="pt-4 text-center">
                        <h4 className="text-md font-semibold mb-1">Starts In:</h4>
                        <div className="text-2xl font-bold text-blue-400">
                            {timeRemaining.days ? `${timeRemaining.days}d ` : ""}
                            {String(timeRemaining.hours || 0).padStart(2, '0')}:
                            {String(timeRemaining.minutes || 0).padStart(2, '0')}:
                            {String(timeRemaining.seconds || 0).padStart(2, '0')}
                        </div>
                    </div>
                )}
                {booking.status === 'completed' && <p className="pt-4 text-green-500 font-semibold text-center">This parking session has ended.</p>}
                {booking.status === 'cancelled' && <p className="pt-4 text-red-500 font-semibold text-center">This booking has been cancelled.</p>}
                
                {booking.status === 'upcoming' && (
                  <Card className="mt-6 border-dashed bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <QrCode className="w-5 h-5 mr-2 text-accent icon-glow" /> Your E-Ticket
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center flex flex-col items-center">
                      <div className="bg-white p-3 inline-block rounded-lg shadow-md mb-3" data-ai-hint="qr code">
                        {/* Placeholder for QR Code Image using a simple SVG representation */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-grid text-foreground">
                          <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                           {/* Simple inner pattern */}
                          <rect width="3" height="3" x="5" y="5" rx="0.5"/><rect width="3" height="3" x="16" y="5" rx="0.5"/><rect width="3" height="3" x="16" y="16" rx="0.5"/><rect width="3" height="3" x="5" y="16" rx="0.5"/>
                          <line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="8" x2="12" y2="16" />
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground">Present this QR code at the entry barrier or scanner.</p>
                      <p className="text-xs text-muted-foreground mt-1">Also available in your confirmation email.</p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button className="w-full sm:w-auto" onClick={() => alert("Mock navigation to " + space.address)}>
                  <Navigation className="mr-2 h-4 w-4"/> Get Directions
                </Button>
                {isCancellable && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto">Cancel Booking</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirm Cancellation</AlertDialogTitle><AlertDialogDescription>Are you sure you want to cancel this booking? This action might be irreversible depending on the cancellation policy.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Keep Booking</AlertDialogCancel><AlertDialogAction onClick={handleCancelBooking} className="bg-destructive hover:bg-destructive/80">Confirm Cancel</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
              </CardFooter>
            </Card>
          </div>
          
          <div className="lg:col-span-5">
            {canExtend && (
              <Card className="shadow-xl sticky top-24"> {/* Sticky form */}
                <CardHeader>
                  <CardTitle className="text-xl flex items-center"><Timer className="mr-2 h-5 w-5 text-accent icon-glow" /> Extend Parking Time</CardTitle>
                  <CardDescription>Need more time? Extend your session easily.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExtendParkingForm currentBooking={booking} pricePerHour={space.pricePerHour} onExtend={handleExtendParking} />
                </CardContent>
              </Card>
            )}
            {(booking.status === 'completed' || booking.status === 'cancelled') && (
                <Card className="shadow-xl text-center sticky top-24">
                    <CardContent className="p-6">
                        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Session Ended or Cancelled</h3>
                        <p className="text-sm text-muted-foreground mb-3">This booking is no longer active. You can find a new spot or view your history.</p>
                        <div className="flex gap-2 justify-center">
                            <Button asChild><Link href="/search">Find New Parking</Link></Button>
                            <Button variant="outline" asChild><Link href="/dashboard/bookings">View History</Link></Button>
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

