
"use client";
import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Lock, CreditCard, CalendarIcon, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface BookingDetailsForPayment {
  bookingId: string;
  facilityName: string;
  facilityAddress: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  vehiclePlate?: string;
}

const paymentFormSchema = z.object({
  cardNumber: z.string()
    .min(16, "Card number must be 16 digits.")
    .max(16, "Card number must be 16 digits.")
    .regex(/^\d+$/, "Card number must only contain digits."),
  expiryDate: z.string()
    .min(5, "Expiry date must be MM/YY.")
    .max(5, "Expiry date must be MM/YY.")
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Invalid expiry date format (MM/YY)."),
  cvv: z.string()
    .min(3, "CVV must be 3 digits.")
    .max(3, "CVV must be 3 digits.")
    .regex(/^\d+$/, "CVV must only contain digits."),
  nameOnCard: z.string().min(2, "Name on card is required."),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

function PaymentPageComponentInternal() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bookingDetails, setBookingDetails] = useState<BookingDetailsForPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      nameOnCard: "",
    },
  });
  
  useEffect(() => {
    const bookingId = params.bookingId as string;
    const facilityName = searchParams.get('facilityName');
    const facilityAddress = searchParams.get('facilityAddress');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const cost = searchParams.get('cost');
    const vehiclePlate = searchParams.get('vehiclePlate');

    if (!bookingId || !facilityName || !facilityAddress || !startTime || !endTime || !cost) {
      console.error("Missing payment page details from query params.");
      toast({
        title: "Payment Error",
        description: "Could not load all booking details for payment. Please try booking again.",
        variant: "destructive",
      });
      router.replace("/search"); 
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

  async function onSubmit(values: PaymentFormValues) {
    if (!bookingDetails) return;
    setIsProcessingPayment(true);
    console.log("Simulating payment processing with:", values);

    // Simulate API delay for payment
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Payment Successful (Mock)",
      description: `Your payment of $${bookingDetails.totalCost.toFixed(2)} for ${bookingDetails.facilityName} was processed.`,
    });
    setIsProcessingPayment(false);

    // Redirect to confirmation page, passing through the original booking details
    const confirmationQueryParams = new URLSearchParams();
    confirmationQueryParams.set('bookingId', bookingDetails.bookingId);
    confirmationQueryParams.set('facilityName', bookingDetails.facilityName);
    confirmationQueryParams.set('facilityAddress', bookingDetails.facilityAddress);
    confirmationQueryParams.set('startTime', bookingDetails.startTime);
    confirmationQueryParams.set('endTime', bookingDetails.endTime);
    confirmationQueryParams.set('cost', bookingDetails.totalCost.toString());
    if (bookingDetails.vehiclePlate) {
      confirmationQueryParams.set('vehiclePlate', bookingDetails.vehiclePlate);
    }

    router.push(`/booking/confirmation?${confirmationQueryParams.toString()}`);
  }

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2 && e.target.value.length < value.length && value.indexOf('/') === -1 && e.nativeEvent.inputType !== 'deleteContentBackward') {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    form.setValue('expiryDate', value);
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
          <PageTitle title="Payment Error" description="Could not load booking details for payment." />
           <Button onClick={() => router.push('/search')}>Start New Search</Button>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle title="Complete Your Payment" description={`Securely pay for your parking at ${bookingDetails.facilityName}.`} />
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p><strong>Facility:</strong> {bookingDetails.facilityName}</p>
                <p><strong>Address:</strong> {bookingDetails.facilityAddress}</p>
                <p><strong>Date:</strong> {format(new Date(bookingDetails.startTime), "MMMM d, yyyy")}</p>
                <p><strong>Time:</strong> {format(new Date(bookingDetails.startTime), "p")} - {format(new Date(bookingDetails.endTime), "p")}</p>
                {bookingDetails.vehiclePlate && <p><strong>Vehicle:</strong> {bookingDetails.vehiclePlate}</p>}
                <p className="text-2xl font-bold pt-2">Total Amount: ${bookingDetails.totalCost.toFixed(2)}</p>
              </CardContent>
            </Card>
             <Card className="border-dashed bg-muted/30">
              <CardContent className="p-4 flex items-start gap-3 text-sm">
                <Lock className="h-5 w-5 text-primary mt-0.5 icon-glow-primary shrink-0" />
                <div>
                  <strong>Secure Payment:</strong> Your payment information is handled securely. This is a mock payment form for demonstration purposes only. No real transaction will occur.
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle className="text-xl">Enter Payment Details</CardTitle>
                <CardDescription>Mock Payment Form</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="nameOnCard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name on Card</FormLabel>
                          <FormControl>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground icon-glow" />
                                <Input placeholder="Your Name" {...field} className="pl-9" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cardNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Card Number</FormLabel>
                           <FormControl>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground icon-glow" />
                                <Input placeholder="0000 0000 0000 0000" {...field} maxLength={19} onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                                    field.onChange(value.slice(0,19));
                                }} className="pl-9" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground icon-glow" />
                                    <Input placeholder="MM/YY" {...field} onChange={handleExpiryDateChange} maxLength={5} className="pl-9" />
                                </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cvv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CVV</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground icon-glow" />
                                    <Input type="password" placeholder="123" {...field} maxLength={3} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} className="pl-9" />
                                </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isProcessingPayment}>
                      {isProcessingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessingPayment ? "Processing..." : `Pay $${bookingDetails.totalCost.toFixed(2)}`}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PaymentPageComponentInternal />
    </Suspense>
  );
}
