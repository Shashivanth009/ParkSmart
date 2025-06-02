
// No "use client" here - this is now primarily a Server Component wrapper

import { BookingClientContent } from '@/components/booking/BookingClientContent';
import type { ParkingSpace } from '@/types';

// Mock data needed for generateStaticParams
const mockSpacesData: ParkingSpace[] = [
    { id: 'ps1', facilityName: 'City Center Parking', facilityAddress: '123 Main St, Anytown', availability: 'high', pricePerHour: 2.5, features: ['covered', 'ev-charging', 'cctv'], facilityCoordinates: { lat: 28.6139, lng: 77.2090 }, facilityRating: 4.5, availableSpots: 50, totalSpots: 100, imageUrl: 'https://placehold.co/800x450.png', slotLabel: 'N/A', floorLevel: 'N/A', isOccupied: false, slotType: 'standard', dataAiHint: "parking garage entrance"},
    { id: 'ps2', facilityName: 'Downtown Garage', facilityAddress: '456 Oak Ave, Anytown', availability: 'medium', pricePerHour: 3.0, features: ['cctv', 'secure'], facilityCoordinates: { lat: 28.6150, lng: 77.2100 }, facilityRating: 4.2, availableSpots: 20, totalSpots: 80, imageUrl: 'https://placehold.co/800x450.png', slotLabel: 'N/A', floorLevel: 'N/A', isOccupied: false, slotType: 'standard', dataAiHint: "modern parking structure" },
];

export async function generateStaticParams() {
  return mockSpacesData.map((space) => ({
    spaceId: space.id,
  }));
}

// This is the Server Component part of the page
export default function BookingPageWrapper({ params }: { params: { spaceId: string } }) {
  // This component itself is a Server Component.
  // It passes the spaceId to the Client Component which handles all rendering and logic.
  return <BookingClientContent spaceIdFromParams={params.spaceId} />;
}
