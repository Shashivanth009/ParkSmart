
export interface ParkingSpace {
  id: string;
  name: string;
  address: string;
  availability: 'high' | 'medium' | 'low' | 'full';
  pricePerHour: number;
  features: Array<'covered' | 'ev-charging' | 'cctv' | 'disabled-access' | 'well-lit' | 'secure'>; // Added new features
  coordinates: { lat: number; lng: number };
  imageUrl?: string;
  rating?: number; // e.g., 4.5
  totalSpots?: number;
  availableSpots?: number;
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
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: {
    defaultVehiclePlate?: string;
    requireCovered?: boolean;
    requireEVCharging?: boolean;
  };
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet';
  details: string; // e.g., "Visa **** 1234" or "user@upi"
  isDefault: boolean;
  expiryDate?: string; // For cards "MM/YY"
}

export interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  spaceId?: string; // If it's a specific space
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

