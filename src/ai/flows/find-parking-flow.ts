
'use server';
/**
 * @fileOverview A Genkit flow to find and generate fictional parking space suggestions.
 *
 * - findParkingSpots - A function that uses an AI model to generate parking spots.
 * - FindParkingInput - The input type for the findParkingSpots function.
 * - FindParkingOutput - The return type for the findParkingSpots function.
 */

import { ai } from '@/ai/genkit';
import type { ParkingSpace, ParkingFeature } from '@/types';
import { z } from 'genkit';

// Define a Zod schema for individual parking spaces consistent with the ParkingSpace type
const ParkingSpaceSchema = z.object({
  id: z.string().describe("A unique identifier for the parking space, e.g., 'ai-park-123'."),
  name: z.string().describe("A plausible name for the parking facility."),
  address: z.string().describe("A plausible street address for the parking facility, relevant to the searched location."),
  coordinates: z.object({
    lat: z.number().describe("Latitude, a plausible value near the searched location and within the specified radius."),
    lng: z.number().describe("Longitude, a plausible value near the searched location and within the specified radius."),
  }).describe("Geographical coordinates of the parking space."),
  availability: z.enum(['high', 'medium', 'low', 'full']).describe("Current estimated availability status."),
  pricePerHour: z.number().positive().describe("Price per hour in a standard currency (e.g., USD)."),
  features: z.array(z.enum(['covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'])).describe("List of features available at the parking space."),
  imageUrl: z.string().url().describe("A placeholder image URL, should be 'https://placehold.co/600x400.png'."),
  dataAiHint: z.string().describe("A two-word hint for the placeholder image, e.g., 'parking garage' or 'city parking'."),
  rating: z.number().min(1).max(5).optional().describe("A user rating between 1 and 5."),
  totalSpots: z.number().int().positive().optional().describe("Total number of spots in the facility."),
  availableSpots: z.number().int().min(0).optional().describe("Number of currently available spots. Should be less than or equal to totalSpots."),
});

// NOT EXPORTED: Zod schema objects
const FindParkingInputSchema = z.object({
  locationName: z.string().describe('The name of the location or area to search for parking, e.g., "Downtown Hyderabad" or "Near Charminar".'),
  searchRadiusKm: z.number().positive().describe('The search radius in kilometers around the locationName.'),
  desiredFeatures: z.array(z.enum(['covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'])).optional().describe('A list of desired features for the parking spots.'),
});
export type FindParkingInput = z.infer<typeof FindParkingInputSchema>;

// NOT EXPORTED: Zod schema objects
const FindParkingOutputSchema = z.object({
  parkingSpaces: z.array(ParkingSpaceSchema).describe('A list of 3 to 5 generated fictional parking spots.'),
});
export type FindParkingOutput = z.infer<typeof FindParkingOutputSchema>;


const findParkingPrompt = ai.definePrompt({
  name: 'findParkingPrompt',
  input: { schema: FindParkingInputSchema },
  output: { schema: FindParkingOutputSchema },
  prompt: `You are an AI assistant that helps users find fictional parking spots for a prototype application.
Given a location name ({{{locationName}}}), a search radius of {{{searchRadiusKm}}} km, and optionally, a list of desired features ({{#if desiredFeatures}}{{#each desiredFeatures}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}any{{/if}}), please generate a list of 3 to 5 distinct, fictional parking spots.

For each parking spot, you must provide the following details:
- id: A unique identifier string, like 'ai-park-XYZ'.
- name: A plausible name for the parking facility (e.g., "City Center Garage", "SecureTech Parking Hitech City").
- address: A plausible street address relevant to the "{{{locationName}}}".
- coordinates: An object with 'lat' and 'lng' (latitude and longitude). These coordinates should be plausible for the given "{{{locationName}}}" and fall roughly within the {{{searchRadiusKm}}} km radius. Make them distinct for each spot.
- availability: Current estimated availability, choose one from: 'high', 'medium', 'low', 'full'.
- pricePerHour: A reasonable price per hour (e.g., between 1.0 and 5.0).
- features: An array of strings, listing features available. If specific desiredFeatures were provided, try to include some of them. Allowed features are: 'covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'.
- imageUrl: This must be exactly 'https://placehold.co/600x400.png'.
- dataAiHint: A two-word hint for the placeholder image, e.g., "parking garage" or "city parking".
- rating: (Optional) A user rating between 1.0 and 5.0.
- totalSpots: (Optional) Total number of spots in the facility (e.g., 50 to 200).
- availableSpots: (Optional) Number of currently available spots (must be less than or equal to totalSpots). If availability is 'full', availableSpots should be 0.

Ensure the generated parking spots are varied.
`,
});

const findParkingGenkitFlow = ai.defineFlow(
  {
    name: 'findParkingGenkitFlow',
    inputSchema: FindParkingInputSchema,
    outputSchema: FindParkingOutputSchema,
  },
  async (input) => {
    // In a real scenario, you might add pre-processing or call external APIs here.
    // For instance, geocoding locationName to get precise coordinates if the model needs it.
    
    const { output } = await findParkingPrompt(input);
    if (!output) {
        // Handle the case where the prompt might not return output as expected.
        // This could be due to safety settings or other model constraints.
        console.warn('AI prompt did not return output for findParkingGenkitFlow. Input:', input);
        return { parkingSpaces: [] };
    }

    // Post-processing: Ensure availableSpots is consistent with totalSpots and availability
    const processedSpaces = output.parkingSpaces.map(space => {
        let processedSpace = { ...space };
        if (processedSpace.totalSpots !== undefined && processedSpace.availableSpots !== undefined) {
            processedSpace.availableSpots = Math.min(processedSpace.availableSpots, processedSpace.totalSpots);
        }
        if (processedSpace.availability === 'full') {
            processedSpace.availableSpots = 0;
        } else if (processedSpace.availability === 'high' && processedSpace.totalSpots && (processedSpace.availableSpots === undefined || processedSpace.availableSpots < processedSpace.totalSpots / 2) ) {
            processedSpace.availableSpots = Math.floor(processedSpace.totalSpots * 0.75) || processedSpace.availableSpots; // Ensure high means many spots
        }
        // Add dataAiHint if missing, as it's now required by ParkingSpace but optional in schema for AI flexibility
        if (!processedSpace.dataAiHint) {
            processedSpace.dataAiHint = "parking lot"; // Default hint
        }
        return processedSpace as ParkingSpace; // Cast to ensure type compatibility after processing
    });

    return { parkingSpaces: processedSpaces };
  }
);

export async function findParkingSpots(input: FindParkingInput): Promise<ParkingSpace[]> {
  const result = await findParkingGenkitFlow(input);
  return result.parkingSpaces;
}

// Helper to add dataAiHint to ParkingSpace type as it was missing
declare module '@/types' {
    interface ParkingSpace {
        dataAiHint?: string; // Make it optional in base type to match AI behavior if needed
    }
}
