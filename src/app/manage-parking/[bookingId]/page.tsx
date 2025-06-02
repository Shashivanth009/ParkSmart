
// No "use client" here - this is now primarily a Server Component wrapper

import { ManageParkingClientContent } from '@/components/booking/ManageParkingClientContent';
import type { Booking } from '@/types'; // For mockBookingsForStaticParams type

// Mock data needed for generateStaticParams.
// These IDs should match what the dashboard overview links to (e.g., b1, b2)
// and what fetchBookingAndSpaceDetails in the client component can find.
const mockBookingsForStaticParams: Pick<Booking, 'id'>[] = [
  { id: 'b1' }, // From dashboard overview mock
  { id: 'b2' }, // From dashboard overview mock
  // Add other specific booking IDs you want to pre-render if necessary,
  // e.g., if other parts of the app link to specific mock booking IDs.
  // For now, focusing on dashboard links.
  // { id: 'bk_active1' }, // Example if these were used elsewhere
  // { id: 'bk_upcoming1' },
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
