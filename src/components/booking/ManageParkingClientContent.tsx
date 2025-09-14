
"use client";
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Booking, ParkingSpace } from '@/types';
import { MapPin, CalendarDays, Clock, Car, CircleDollarSign, Navigation, Timer, Loader2, AlertTriangle, QrCode, CheckCircle2 } from 'lucide-react';
import { format, differenceInMinutes, intervalToDuration, isPast, isFuture } from 'date-fns';
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

const fetchBookingAndSpaceDetails = async (bookingId: string): Promise<{ booking: Booking | null; space: ParkingSpace | null }> => {
  console.log("Fetching details for booking:", bookingId);
  await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API delay
  
  const mockBookings: Booking[] = [
    { id: 'b1', spaceId: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', startTime: new Date(Date.now() + 3600000 * 2).toISOString(), endTime: new Date(Date.now() + 3600000 * 4).toISOString(), totalCost: 7.50, status: 'upcoming', vehiclePlate: 'UPC 001' },
    { id: 'b2', spaceId: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Metropolis', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), totalCost: 9.00, status: 'active', vehiclePlate: 'ACT 123' },
    { id: 'bk_active1', spaceId: 'ps1', facilityName: 'City Center Parking (Active)', facilityAddress: '123 Main St, Anytown', startTime: new Date(Date.now() - 3600000 * 1).toISOString(), endTime: new Date(Date.now() + 3600000 * 2).toISOString(), totalCost: 7.50, status: 'active', vehiclePlate: 'ACT 001' },
    { id: 'bk_upcoming1', spaceId: 'ps2', facilityName: 'Downtown Garage (Upcoming)', facilityAddress: '456 Oak Ave, Anytown', startTime: new Date(Date.now() + 3600000 * 3).toISOString(), endTime: new Date(Date.now() + 3600000 * 5).toISOString(), totalCost: 9.00, status: 'upcoming', vehiclePlate: 'UPC 002' },
  ];
  const mockSpaces: ParkingSpace[] = [
    { id: 'ps1', slotLabel: 'A1', floorLevel: 'P1', isOccupied: false, slotType: 'standard', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', availability: 'medium', pricePerHour: 2.5, features: ['covered', 'ev-charging'], facilityCoordinates: { lat: 28.6139, lng: 77.2090 }, imageUrl: 'https://placehold.co/600x400.png', dataAiHint: 'garage interior', facilityRating: 4.2, totalSpots: 100, availableSpots: 50},
    { id: 'ps2', slotLabel: 'B5', floorLevel: 'P2', isOccupied: true, slotType: 'ev-charging', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Anytown', availability: 'high', pricePerHour: 3.0, features: ['secure'], facilityCoordinates: { lat: 28.6150, lng: 77.2100 }, imageUrl: 'https://placehold.co/600x400.png', dataAiHint: 'underground parking', facilityRating: 4.0, totalSpots: 80, availableSpots: 30},
  ];

  const booking = mockBookings.find(b => b.id === bookingId) || null;
  const space = booking ? mockSpaces.find(s => s.id === booking.spaceId) || null : null;
  
  return { booking, space };
};


export function ManageParkingClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [space, setSpace] = useState<ParkingSpace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<Duration | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (bookingId) {
      setIsLoading(true);
      fetchBookingAndSpaceDetails(bookingId)
        .then(data => {
          setBooking(data.booking);
          setSpace(data.space);
        })
        .catch(err => {
          console.error("Failed to fetch booking/space details:", err);
          toast({title: "Error", description: "Could not load booking details.", variant: "destructive"});
        }).finally(() => {
            setIsLoading(false);
        });
    } else {
        setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;

    // Auto-update status from upcoming to active if start time is reached
    if (booking.status === 'upcoming' && isPast(new Date(booking.startTime)) && isFuture(new Date(booking.endTime))) {
        setBooking(prev => prev ? { ...prev, status: 'active' } : null);
    }
    // Auto-update status to completed if end time is passed
    if (booking.status === 'active' && isPast(new Date(booking.endTime))) {
        setBooking(prev => prev ? { ...prev, status: 'completed' } : null);
    }


    if (booking.status === 'active' && booking.startTime && booking.endTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const startTimeDate = new Date(booking.startTime);
        const endTimeDate = new Date(booking.endTime);
        
        if (now >= endTimeDate) {
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
          setProgress(100);
          clearInterval(timer);
          setBooking(prev => prev ? ({ ...prev, status: 'completed'}) : null);
          return;
        }
        
        const remaining = intervalToDuration({ start: now, end: endTimeDate });
        setTimeRemaining(remaining);
        
        const totalDurationMinutes = differenceInMinutes(endTimeDate, startTimeDate);
        const elapsedMinutes = differenceInMinutes(now, startTimeDate);
        const currentProgress = totalDurationMinutes > 0 ? Math.min(100, (elapsedMinutes / totalDurationMinutes) * 100) : (now >= endTimeDate ? 100 : 0);
        setProgress(currentProgress);

      }, 1000);
      return () => clearInterval(timer);
    } else if (booking.status === 'upcoming' && booking.startTime) {
        const startTimeDate = new Date(booking.startTime);
        const now = new Date();
        if (now < startTimeDate) {
            const timer = setInterval(() => {
                const currentNow = new Date();
                 if (currentNow >= startTimeDate) {
                    setBooking(prev => prev ? ({ ...prev, status: 'active'}) : null);
                    clearInterval(timer);
                    return;
                 }
                 setTimeRemaining(intervalToDuration({ start: currentNow, end: startTimeDate }));
            }, 1000);
            setTimeRemaining(intervalToDuration({ start: now, end: startTimeDate })); // Initial set
            return () => clearInterval(timer);
        } else if (booking.endTime && now < new Date(booking.endTime)) {
            setBooking(prev => prev ? ({ ...prev, status: 'active'}) : null);
        }
        setProgress(0);
    }
  }, [booking]);


  const handleExtendParking = async (newEndTime: Date, additionalCost: number, extendDuration: number) => {
    if (!booking || !space) return;
    setOperationLoading(true);
    console.log(`Extending booking ${booking.id} by ${extendDuration} hours. New end time: ${newEndTime}, Additional cost: $${additionalCost.toFixed(2)}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setBooking(prev => prev ? ({ ...prev, endTime: newEndTime.toISOString(), totalCost: prev.totalCost + additionalCost }) : null);
    toast({ title: "Parking Extended Successfully", description: `Your parking session now ends at ${format(newEndTime, "p")}. An additional $${additionalCost.toFixed(2)} has been charged (mock).` });
    setOperationLoading(false);
  };

  const handleCancelBooking = async () => {
    if(!booking) return;
    setOperationLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBooking(prev => prev ? ({...prev, status: 'cancelled'}) : null);
    toast({title: "Booking Cancelled", description: `Your booking for ${space?.facilityName} has been cancelled. A refund may be processed according to policy (mock).`});
    setOperationLoading(false);
  };

  const handleNavigate = () => {
    if (space?.facilityAddress) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(space.facilityAddress)}`, '_blank');
    } else {
        alert("Navigation address not available.");
    }
  };


  if (isLoading) { 
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!bookingId) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto px-4 md:px-6 py-8 text-center">
                <PageTitle title="Invalid Request" description="No booking ID was provided in the URL." />
                <Button onClick={() => router.push('/dashboard/bookings')}>View My Bookings</Button>
            </main>
            <Footer />
        </div>
    );
  }

  if (!booking || !space) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 text-center">
          <PageTitle title="Booking Not Found" description="The requested booking could not be found or details are missing." />
          <Button onClick={() => router.push('/dashboard/bookings')}>View My Bookings</Button>
        </main>
        <Footer />
      </div>
    );
  }
  
  const isCancellable = booking.status === 'upcoming' && differenceInMinutes(new Date(booking.startTime), new Date()) > 60; 
  const canExtend = (booking.status === 'active' || (booking.status === 'upcoming' && differenceInMinutes(new Date(booking.startTime), new Date()) < 60 * 2)) && space.pricePerHour !== undefined;
  
  let pageTitle = "Manage Your Booking";
    if (booking.status === 'active') pageTitle = "Active Parking Session";
    else if (booking.status === 'completed') pageTitle = "Completed Booking";
    else if (booking.status === 'cancelled') pageTitle = "Cancelled Booking";

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title={pageTitle} />

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">{booking.facilityName}</CardTitle>
                <CardDescription className="flex items-center text-base pt-1">
                  <MapPin className="w-5 h-5 mr-2 text-muted-foreground icon-glow" /> {booking.facilityAddress}
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
                    <h4 className="text-md font-semibold mb-2 text-center">Time Remaining:</h4>
                    <div className="text-3xl font-bold text-yellow-400 mb-2 text-center">
                      {String(timeRemaining.hours || 0).padStart(2, '0')}:
                      {String(timeRemaining.minutes || 0).padStart(2, '0')}:
                      {String(timeRemaining.seconds || 0).padStart(2, '0')}
                    </div>
                    <Progress value={progress} className="w-full h-3 bg-yellow-400/30 [&>div]:bg-yellow-400" />
                     {operationLoading && <p className="text-xs text-center text-muted-foreground mt-1">Updating session...</p>}
                  </div>
                )}
                {booking.status === 'upcoming' && timeRemaining && !isPast(new Date(booking.startTime)) && (
                    <div className="pt-4 text-center">
                        <h4 className="text-md font-semibold mb-1">Starts In:</h4>
                        <div className="text-2xl font-bold text-blue-400">
                            {timeRemaining.days ? `${timeRemaining.days}d ` : ""}
                            {String(timeRemaining.hours || 0).padStart(2, '0')}:
                            {String(timeRemaining.minutes || 0).padStart(2, '0')}:
                            {String(timeRemaining.seconds || 0).padStart(2, '0')}
                        </div>
                         {operationLoading && <p className="text-xs text-center text-muted-foreground mt-1">Updating status...</p>}
                    </div>
                )}
                {booking.status === 'completed' && <p className="pt-4 text-green-500 font-semibold text-center text-lg">This parking session has ended.</p>}
                {booking.status === 'cancelled' && <p className="pt-4 text-red-500 font-semibold text-center text-lg">This booking has been cancelled.</p>}
                
                {booking.status === 'upcoming' && !isPast(new Date(booking.startTime)) && (
                  <Card className="mt-6 border-dashed bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <QrCode className="w-5 h-5 mr-2 text-accent icon-glow" /> Your E-Ticket
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center flex flex-col items-center">
                      <div className="bg-card p-3 inline-block rounded-lg shadow-md mb-3 ring-1 ring-border" data-ai-hint="qr code example">
                        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 32 32" fill="currentColor" className="text-foreground">
                            <path d="M4 4h8v8H4zm2 2v4h4V6zm10-2h8v8h-8zm2 2v4h4V6zM4 20h8v8H4zm2 2v4h4v-4zm10-2h8v8h-8zm2 2v4h4v-4zM20 4h-4v4h-4v4h4v4h4v-4h4V8h-4z"/>
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground">Present this QR code at the entry barrier or scanner.</p>
                      <p className="text-xs text-muted-foreground mt-1">Also available in your confirmation email (mock).</p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button className="w-full sm:w-auto" onClick={handleNavigate} disabled={operationLoading}>
                  <Navigation className="mr-2 h-4 w-4"/> Get Directions
                </Button>
                {isCancellable && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto" disabled={operationLoading}>Cancel Booking</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirm Cancellation</AlertDialogTitle><AlertDialogDescription>Are you sure you want to cancel this booking? This action might be irreversible depending on the cancellation policy (mock).</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={operationLoading}>Keep Booking</AlertDialogCancel><AlertDialogAction onClick={handleCancelBooking} className="bg-destructive hover:bg-destructive/80" disabled={operationLoading}>Confirm Cancel</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
              </CardFooter>
            </Card>
          </div>
          
          <div className="lg:col-span-5">
            {canExtend && (
              <Card className="shadow-xl sticky top-24">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center"><Timer className="mr-2 h-5 w-5 text-accent icon-glow" /> Extend Parking Time</CardTitle>
                  <CardDescription>Need more time? Extend your session easily.</CardDescription>
                </CardHeader>
                <CardContent>
                  {space.pricePerHour !== undefined ? (
                    <ExtendParkingForm currentBooking={booking} pricePerHour={space.pricePerHour} onExtend={handleExtendParking} />
                  ) : (
                     <p className="text-sm text-muted-foreground text-center p-4">Cannot extend: Price information missing.</p>
                  )}
                </CardContent>
              </Card>
            )}
            {(booking.status === 'completed' || booking.status === 'cancelled') && (
                <Card className="shadow-xl text-center sticky top-24">
                    <CardContent className="p-6">
                        {booking.status === 'completed' ? <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" /> : <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />}
                        <h3 className="text-lg font-semibold mb-1">{booking.status === 'completed' ? 'Session Ended' : 'Booking Cancelled'}</h3>
                        <p className="text-sm text-muted-foreground mb-3">This booking is no longer active. You can find a new spot or view your history.</p>
                        <div className="flex gap-2 justify-center">
                            <Button asChild><Link href="/search">Find New Parking</Link></Button>
                            <Button variant="outline" asChild><Link href="/dashboard/bookings">View History</Link></Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            {(booking.status === 'active' || (booking.status === 'upcoming' && !isCancellable)) && !canExtend && space.pricePerHour === undefined && (
                <Card className="shadow-xl text-center sticky top-24 bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center"><Timer className="mr-2 h-5 w-5 text-muted-foreground" /> Extend Parking Time</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Cannot extend parking currently. Pricing information for this space is unavailable or it's too early/late to extend.</p>
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
