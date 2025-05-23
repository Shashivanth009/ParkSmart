
'use server';
/**
 * @fileOverview A Genkit flow to find and generate fictional parking slot suggestions.
 *
 * - findParkingSpots - A function that uses an AI model to generate parking slots.
 * - FindParkingInput - The input type for the findParkingSpots function.
 * - FindParkingOutput - The return type for the findParkingSpots function.
 */

import { ai } from '@/ai/genkit';
import type { ParkingSpace } from '@/types';
import { z } from 'genkit';

// Define a Zod schema for individual parking SLOTS consistent with the ParkingSpace type
const ParkingSlotSchema = z.object({
  id: z.string().describe("A unique identifier for the parking slot, e.g., 'slot-ai-park-123-s5'."),
  slotLabel: z.string().describe("A label for the slot, e.g., '#5' or 'A-03'."),
  floorLevel: z.string().describe("The floor or level where the slot is located, e.g., 'Floor 1', 'P2', 'Basement Level A'."),
  isOccupied: z.boolean().describe("Whether the slot is currently occupied."),
  vehicleIdOccupying: z.string().optional().describe("The vehicle ID (e.g., license plate) occupying the slot, if 'isOccupied' is true."),
  occupiedSince: z.string().optional().describe("A short string indicating when the slot was occupied, if 'isOccupied' is true (e.g., 'Since: 9:42 AM', '2 hours ago')."),
  slotType: z.enum(['standard', 'accessible', 'ev-charging']).describe("The type of the parking slot. Choose one: 'standard', 'accessible', 'ev-charging'. This will determine the icon used."),
  
  facilityName: z.string().describe("The name of the parking facility or area these slots belong to. Can be the same for multiple slots if they are in the same facility."),
  facilityAddress: z.string().describe("The street address of the parking facility, relevant to the searched location."),
  facilityCoordinates: z.object({
    lat: z.number().describe("Latitude of the facility, plausible value near the searched location."),
    lng: z.number().describe("Longitude of the facility, plausible value near the searched location."),
  }).describe("Geographical coordinates of the parking facility."),
  pricePerHour: z.number().optional().describe("Price per hour for this type of slot in this facility (e.g., USD). Ensure it's a positive number, ideally between 1.0 and 10.0."),
  
  imageUrl: z.string().optional().describe("A placeholder image URL for the FACILITY, must be 'https://placehold.co/600x400.png'."),
  dataAiHint: z.string().optional().describe("A two-word hint for the placeholder FACILITY image, e.g., 'restaurant parking', 'park entrance', 'hotel garage', 'mall exterior', 'street meters', 'office building'."),
  facilityRating: z.number().optional().describe("An overall user rating for the facility, a number between 1 and 5 (e.g., 4.2)."),

  availability: z.enum(['high', 'medium', 'low', 'full']).optional().describe("Overall availability in the FACILITY (less critical for individual slot status)."),
  features: z.array(z.enum(['covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'])).optional().describe("List of general features of the FACILITY."),
  totalSpots: z.number().int().optional().describe("Total number of spots in the FACILITY. Must be a positive integer."),
  availableSpots: z.number().int().optional().describe("Number of currently available spots in the FACILITY. Must be a non-negative integer, and not more than totalSpots."),
});


const FindParkingInputSchema = z.object({
  locationName: z.string().describe('The name of the location or area to search for parking, e.g., "Downtown Hyderabad" or "Near Charminar".'),
  searchRadiusKm: z.number().positive().describe('The search radius in kilometers around the locationName.'),
  desiredFeatures: z.array(z.enum(['covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'])).optional().describe('A list of desired general facility features for the parking spots.'),
});
export type FindParkingInput = z.infer<typeof FindParkingInputSchema>;


const FindParkingOutputSchema = z.object({
  parkingSlots: z.array(ParkingSlotSchema).describe('A list of 10 to 15 generated fictional parking slots. These slots can be from one or more conceptual facilities relevant to the search query.'),
});
export type FindParkingOutput = z.infer<typeof FindParkingOutputSchema>;


const findParkingPrompt = ai.definePrompt({
  name: 'findParkingSlotsPrompt',
  input: { schema: FindParkingInputSchema },
  output: { schema: FindParkingOutputSchema },
  prompt: `You are an AI assistant that helps users find fictional parking slots for a prototype application.
Given a location name ({{{locationName}}}), a search radius of {{{searchRadiusKm}}} km, and optionally, a list of desired general facility features ({{#if desiredFeatures}}{{#each desiredFeatures}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}any{{/if}}), you MUST generate a list of 10 to 15 distinct, fictional parking SLOTS. Do not under any circumstances return an empty list or fewer than 10 slots; be creative and imagine possibilities if needed.

These slots MUST be plausibly located near or associated with common points of interest such as restaurants, public parks, shopping centers, hotels, transport hubs, or public buildings that one might find in or near "{{{locationName}}}".
The slots can be from one or multiple conceptual parking facilities that would plausibly be in the searched area.

For each parking SLOT, you must provide the following details:
- id: A unique identifier string for the slot, like 'slot-ai-park-restaurant-s1'.
- slotLabel: A short label for the slot, like "#12" or "B-07".
- floorLevel: The floor or level, like "Floor 1", "P3", "Restaurant Valet Area", "Hotel Basement P2".
- isOccupied: A boolean (true or false) indicating if the slot is currently occupied.
- vehicleIdOccupying: (Only if isOccupied is true) A fictional vehicle license plate or ID, like "TS09FOODIE".
- occupiedSince: (Only if isOccupied is true) A short string indicating when it was occupied, like "Since: 1:30 PM" or "45 min ago".
- slotType: Choose one type for the slot: 'standard', 'accessible', or 'ev-charging'. If user requested 'ev-charging' or 'disabled-access' as a desired feature, try to include slots of that type.
- facilityName: The name of the parking facility this slot belongs to (e.g., "Park 'n Dine Central", "GreenView Parkade", "Market Square Garage", "Grand Hotel Parking", "City Park Lot"). Make up 1-3 plausible facility names reflecting the context (e.g., near a park, restaurant, hotel) and distribute the 10-15 slots among them.
- facilityAddress: A plausible street address for the facility, relevant to "{{{locationName}}}".
- facilityCoordinates: An object with 'lat' and 'lng' for the FACILITY. These coordinates should be plausible for "{{{locationName}}}" and fall roughly within the {{{searchRadiusKm}}} km radius. Slots within the same facility should share these coordinates.
- pricePerHour: (Optional) A reasonable price per hour for this slot type/facility (e.g., a number between 1.0 and 10.0, like 2.5 or 3.0).
- imageUrl: This must be exactly 'https://placehold.co/600x400.png' for the FACILITY.
- dataAiHint: A two-word hint for the placeholder FACILITY image, reflecting the facility type or context (e.g., "restaurant parking", "park entrance", "hotel garage", "shopping mall", "office building"). Be varied.
- facilityRating: (Optional) An overall rating for the FACILITY (e.g., a number between 1.0 and 5.0, like 3.5 or 4.8).
- totalSpots: (Optional) Total number of spots in the FACILITY (e.g., 50, 120). Must be a positive integer.
- availableSpots: (Optional) Number of currently available spots in the FACILITY (e.g., 15, 40). Must be a non-negative integer, and not more than totalSpots.

Ensure the generated slots are varied in their occupancy status and type. If 'desiredFeatures' includes 'ev-charging' or 'disabled-access', make sure to generate some slots with matching 'slotType'.
The primary output should be the list of individual parking slots. Your response MUST contain 10 to 15 slots.
`,
});

const findParkingGenkitFlow = ai.defineFlow(
  {
    name: 'findParkingSlotsGenkitFlow',
    inputSchema: FindParkingInputSchema,
    outputSchema: FindParkingOutputSchema,
  },
  async (input) => {    
    const { output } = await findParkingPrompt(input);
    if (!output || !output.parkingSlots || output.parkingSlots.length === 0) {
        console.warn('AI prompt did not return expected output for findParkingSlotsGenkitFlow. Input:', input);
        // Fallback: Generate some very basic dummy slots if AI fails, though the prompt now strongly discourages this.
        return { parkingSlots: Array.from({ length: 10 }, (_, i) => ({
            id: `fallback-slot-${Date.now()}-${i}`, // Ensure unique fallback IDs
            slotLabel: `F${i+1}`,
            floorLevel: 'Ground',
            isOccupied: i % 2 === 0,
            slotType: 'standard',
            facilityName: 'Fallback Facility',
            facilityAddress: input.locationName || 'Unknown Location',
            facilityCoordinates: { lat: 17.3850, lng: 78.4867 }, // Default to a known location
            imageUrl: 'https://placehold.co/600x400.png',
            dataAiHint: 'generic parking',
            pricePerHour: 2.0,
            facilityRating: 3.0,
            totalSpots: 20,
            availableSpots: 10,
        })) as ParkingSpace[]};
    }

    const processedSlots = output.parkingSlots.map(slot => {
        let processedSlot = { ...slot } as ParkingSpace; 
        if (!processedSlot.isOccupied) {
            processedSlot.vehicleIdOccupying = undefined;
            processedSlot.occupiedSince = undefined;
        }
        if (!processedSlot.imageUrl || !processedSlot.imageUrl.startsWith('https://placehold.co/')) {
            processedSlot.imageUrl = 'https://placehold.co/600x400.png';
        }
        if (!processedSlot.dataAiHint || processedSlot.dataAiHint.split(' ').length > 2) {
            processedSlot.dataAiHint = 'parking area'; 
        }
        // Ensure pricePerHour is a number and positive if present
        if (processedSlot.pricePerHour !== undefined) {
            const price = Number(processedSlot.pricePerHour);
            processedSlot.pricePerHour = isNaN(price) || price < 0 ? undefined : price;
        }
         // Ensure facilityRating is a number and within range if present
        if (processedSlot.facilityRating !== undefined) {
            const rating = Number(processedSlot.facilityRating);
            processedSlot.facilityRating = isNaN(rating) || rating < 0 || rating > 5 ? undefined : rating;
        }
        return processedSlot;
    });

    return { parkingSlots: processedSlots };
  }
);

export async function findParkingSpots(input: FindParkingInput): Promise<ParkingSpace[]> {
  const result = await findParkingGenkitFlow(input);
  return result.parkingSlots;
}

