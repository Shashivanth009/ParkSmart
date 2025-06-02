
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';


// Represents an individual parking slot with facility context
export interface ParkingSpace {
  id: string;
  slotLabel: string;
  floorLevel: string;
  isOccupied: boolean;
  vehicleIdOccupying?: string;
  occupiedSince?: string;
  slotType: 'standard' | 'accessible' | 'ev-charging';

  facilityName: string;
  facilityAddress: string;
  facilityCoordinates: { lat: number; lng: number };
  pricePerHour?: number;

  imageUrl?: string;
  dataAiHint?: string;
  facilityRating?: number;

  availability?: 'high' | 'medium' | 'low' | 'full';
  features?: ParkingFeature[];
  totalSpots?: number;
  availableSpots?: number;
}


export interface Booking {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceAddress: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  vehiclePlate?: string;
}

export interface UserProfile {
  name: string; // Made non-optional, default will be provided
  email: string; // Made non-optional, default will be provided
  phone?: string;
  avatarUrl?: string | null;
  preferences?: {
    defaultVehiclePlate?: string;
    requireCovered?: boolean;
    requireEVCharging?: boolean;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet';
  details: string;
  isDefault: boolean;
  expiryDate?: string;
}

export interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  spaceId?: string;
  notes?: string;
}

export type ParkingFeature = 'covered' | 'ev-charging' | 'cctv' | 'disabled-access' | 'well-lit' | 'secure';

export const featureIcons: Record<ParkingFeature, React.ElementType> = {
  covered: require('lucide-react').ParkingSquare,
  'ev-charging': require('lucide-react').BatteryCharging,
  cctv: require('lucide-react').Camera,
  'disabled-access': require('lucide-react').Accessibility,
  'well-lit': require('lucide-react').Sun,
  secure: require('lucide-react').ShieldCheck,
};

export const featureLabels: Record<ParkingFeature, string> = {
  covered: 'Covered Parking',
  'ev-charging': 'EV Charging',
  cctv: 'CCTV Surveillance',
  'disabled-access': 'Disabled Access',
  'well-lit': 'Well Lit',
  secure: 'Secure Parking',
};

export const slotTypeIcons: Record<ParkingSpace['slotType'], LucideIcon> = {
    standard: require('lucide-react').CarFront,
    accessible: require('lucide-react').Accessibility,
    'ev-charging': require('lucide-react').Zap,
};

