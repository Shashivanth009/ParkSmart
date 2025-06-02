
// No "use client" here - this is now primarily a Server Component wrapper

import { ManageParkingClientContent } from '@/components/booking/ManageParkingClientContent';
import type { Booking } from '@/types'; // For mockBookingsForStaticParams type

// Mock data needed for generateStaticParams.
// These IDs should match what fetchBookingAndSpaceDetails in the client component can find.
const mockBookingsForStaticParams: Pick<Booking, 'id'>[] = [
  { id: 'bk_active1' },
  { id: 'bk_upcoming1' },
  // Add other specific booking IDs you want to pre-render if necessary
];

export async function generateStaticParams() {
  return mockBookingsForStaticParams.map((booking) => ({
    bookingId: booking.id,
  }));
}

// This is the Server Component part of the page
export default function ManageParkingPageWrapper({ params }: { params: { bookingId: string } }) {
  // This component itself is a Server Component.
  // It passes the bookingId to the Client Component which handles all rendering and logic.
  return <ManageParkingClientContent bookingIdFromParams={params.bookingId} />;
}
