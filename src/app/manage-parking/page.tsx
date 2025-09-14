
"use client";
import { Suspense } from 'react';
import { ManageParkingClientContent } from '@/components/booking/ManageParkingClientContent';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function ManageParkingPageInternal() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');

  if (!bookingId) {
    // Handle case where bookingId is missing from URL
    return <div>Error: Booking ID is missing.</div>;
  }

  return <ManageParkingClientContent bookingIdFromParams={bookingId} />;
}

export default function ManageParkingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ManageParkingPageInternal />
    </Suspense>
  );
}
