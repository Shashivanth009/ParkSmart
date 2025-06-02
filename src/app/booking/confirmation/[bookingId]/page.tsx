
"use client";
import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MapPin, CalendarDays, Clock, Car, CircleDollarSign, Navigation, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface BookingDetails {
  bookingId: string;
  facilityName: string;
  facilityAddress: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  vehiclePlate?: string;
}

function ConfirmationPageComponent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bookingId = params.bookingId as string;
    // Use facilityName and facilityAddress as per updated Booking type
    const facilityName = searchParams.get('spaceName') || searchParams.get('facilityName') || 'N/A'; 
    const facilityAddress = searchParams.get('address') || searchParams.get('facilityAddress') || 'N/A';
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const cost = searchParams.get('cost');
    const vehiclePlate = searchParams.get('vehiclePlate');

    if (!bookingId || !startTime || !endTime || !cost) {
      console.error("Missing booking confirmation details.");
      toast({
        title: "Confirmation Error",
        description: "Could not load all booking details. Please check 'My Bookings'.",
        variant: "destructive",
      });
      router.replace("/dashboard/bookings"); 
      return;
    }

    setBookingDetails({
      bookingId,
      facilityName,
      facilityAddress,
      startTime,
      endTime,
      totalCost: parseFloat(cost),
      vehiclePlate: vehiclePlate || undefined,
    });
    setIsLoading(false);
  }, [params, searchParams, router]);

  const handleNavigate = () => {
    if (bookingDetails?.facilityAddress) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bookingDetails.facilityAddress)}`, '_blank');
    } else {
        alert("Navigation address not available.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 flex items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!bookingDetails) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 md:px-6 py-8 text-center">
          <PageTitle title="Booking Confirmation Error" description="Could not load booking details." />
           <Button onClick={() => router.push('/dashboard/bookings')}>View My Bookings</Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <PageTitle title="Booking Confirmed!" />
          <Card className="shadow-xl text-center">
            <CardHeader>
              <div className="mx-auto bg-green-500/20 p-4 rounded-full w-fit mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 icon-glow" />
              </div>
              <CardTitle className="text-2xl">Thank You for Your Booking!</CardTitle>
              <CardDescription>Your parking spot at {bookingDetails.facilityName} is reserved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-left">
              <h3 className="text-lg font-semibold text-center mb-3">Booking Summary (ID: {bookingDetails.bookingId})</h3>
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <p className="flex items-start"><MapPin className="w-5 h-5 mr-3 mt-0.5 text-primary icon-glow-primary flex-shrink-0" /> <strong>Location:</strong> {bookingDetails.facilityName}<br/><span className="ml-[27px] text-sm text-muted-foreground">{bookingDetails.facilityAddress}</span></p>
                <p className="flex items-center"><CalendarDays className="w-5 h-5 mr-3 text-primary icon-glow-primary" /> <strong>Date:</strong> {format(new Date(bookingDetails.startTime), "MMMM d, yyyy")}</p>
                <p className="flex items-center"><Clock className="w-5 h-5 mr-3 text-primary icon-glow-primary" /> <strong>Time:</strong> {format(new Date(bookingDetails.startTime), "p")} - {format(new Date(bookingDetails.endTime), "p")}</p>
                {bookingDetails.vehiclePlate && <p className="flex items-center"><Car className="w-5 h-5 mr-3 text-primary icon-glow-primary" /> <strong>Vehicle:</strong> {bookingDetails.vehiclePlate}</p>}
                <p className="flex items-center text-lg font-semibold"><CircleDollarSign className="w-5 h-5 mr-3 text-primary icon-glow-primary" /> <strong>Total Cost:</strong> ${bookingDetails.totalCost.toFixed(2)}</p>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">A confirmation email has been sent to your registered email address (mock).</p>
              {bookingDetails.vehiclePlate && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Tip: If your parking facility supports License Plate Recognition (LPR), your vehicle may be automatically recognized for entry.
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-5">
              <Button className="w-full sm:w-auto flex-grow" onClick={handleNavigate}>
                <Navigation className="mr-2 h-5 w-5" /> Navigate to Parking
              </Button>
              <Button variant="outline" className="w-full sm:w-auto flex-grow" asChild>
                <Link href="/dashboard/bookings">View My Bookings</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ConfirmationPageComponent />
    </Suspense>
  );
}

// Helper for toast, can be moved to a util if used elsewhere
import { toast } from '@/hooks/use-toast';
