
import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';


// Represents an individual parking slot with facility context
export interface ParkingSpace {
  id: string; // Unique ID for the slot itself
  slotLabel: string; // e.g., "#5" or "A-03"
  floorLevel: string; // e.g., "Floor 1", "P2"
  isOccupied: boolean;
  vehicleIdOccupying?: string; // If occupied, e.g., "ts07fd1463"
  occupiedSince?: string; // If occupied, e.g., "Since: 9:42 AM"
  slotType: 'standard' | 'accessible' | 'ev-charging'; // Determines icon and specific filtering

  // Contextual info about the facility this slot belongs to
  facilityName: string; // Name of the parking garage/lot
  facilityAddress: string; // Address of the parking garage/lot
  facilityCoordinates: { lat: number; lng: number }; // Coordinates for map markers
  pricePerHour?: number; // Price for this type of slot at this facility
  
  imageUrl?: string; // URL for a representative image of the FACILITY
  dataAiHint?: string; // Hint for the FACILITY image (e.g., "parking garage interior")
  facilityRating?: number; // Overall rating of the parking facility

  availability?: 'high' | 'medium' | 'low' | 'full'; // Overall facility availability
  features?: Array<'covered' | 'ev-charging' | 'cctv' | 'disabled-access' | 'well-lit' | 'secure'>; // Facility features
  totalSpots?: number; // Total spots in the facility
  availableSpots?: number; // Available spots in the facility (facility-wide)
}


export interface Booking {
  id: string;
  spaceId: string; 
  spaceName: string;
  spaceAddress: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  totalCost: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  vehiclePlate?: string;
}

export interface UserProfile {
  // uid will be the document ID in Firestore, same as Firebase Auth uid
  name: string;
  email: string; // Stored for convenience, but Firebase Auth email is source of truth
  phone?: string;
  avatarUrl?: string;
  preferences?: {
    defaultVehiclePlate?: string;
    requireCovered?: boolean;
    requireEVCharging?: boolean;
  };
  createdAt?: Timestamp | Date; // Date user profile was created in Firestore
  updatedAt?: Timestamp | Date; // Date user profile was last updated
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
