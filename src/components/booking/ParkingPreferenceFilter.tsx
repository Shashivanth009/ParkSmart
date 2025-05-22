"use client";

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { ParkingFeature } from '@/types';
import { featureLabels } from '@/types'; // Assuming featureLabels is exported from types
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

export interface ParkingFilters {
  priceRange: [number, number];
  features: ParkingFeature[];
  distanceMax: number; // in km
  ratingMin: number;
}

interface ParkingPreferenceFilterProps {
  defaultFilters?: Partial<ParkingFilters>;
  onApplyFilters: (filters: ParkingFilters) => void;
}

const ALL_FEATURES: ParkingFeature[] = ['covered', 'ev-charging', 'cctv', 'disabled-access', 'well-lit', 'secure'];

export function ParkingPreferenceFilter({ defaultFilters, onApplyFilters }: ParkingPreferenceFilterProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>(defaultFilters?.priceRange || [0, 50]);
  const [selectedFeatures, setSelectedFeatures] = useState<ParkingFeature[]>(defaultFilters?.features || []);
  const [distanceMax, setDistanceMax] = useState<number>(defaultFilters?.distanceMax || 5); // default 5km
  const [ratingMin, setRatingMin] = useState<number>(defaultFilters?.ratingMin || 0); // default 0 (any rating)

  const handleFeatureChange = (feature: ParkingFeature, checked: boolean) => {
    setSelectedFeatures(prev => 
      checked ? [...prev, feature] : prev.filter(f => f !== feature)
    );
  };

  const handleApply = () => {
    onApplyFilters({ priceRange, features: selectedFeatures, distanceMax, ratingMin });
  };
  
  const handleReset = () => {
    setPriceRange(defaultFilters?.priceRange || [0, 50]);
    setSelectedFeatures(defaultFilters?.features || []);
    setDistanceMax(defaultFilters?.distanceMax || 5);
    setRatingMin(defaultFilters?.ratingMin || 0);
    onApplyFilters({ 
        priceRange: defaultFilters?.priceRange || [0, 50], 
        features: defaultFilters?.features || [], 
        distanceMax: defaultFilters?.distanceMax || 5, 
        ratingMin: defaultFilters?.ratingMin || 0 
    });
  };

  return (
    <Card className="w-full shadow-lg">
        <CardHeader>
            <CardTitle className="text-lg flex items-center"><SlidersHorizontal className="mr-2 h-5 w-5 text-primary icon-glow-primary" /> Filter Options</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" defaultValue={['price', 'features']} className="w-full">
                <AccordionItem value="price">
                    <AccordionTrigger className="text-base">Price Range (per hour)</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-3">
                    <Slider
                        defaultValue={[priceRange[0], priceRange[1]]}
                        min={0}
                        max={50} // Max price for slider
                        step={1}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                    </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="features">
                    <AccordionTrigger className="text-base">Features</AccordionTrigger>
                    <AccordionContent className="pt-2 grid grid-cols-2 gap-3">
                    {ALL_FEATURES.map(feature => (
                        <div key={feature} className="flex items-center space-x-2">
                        <Checkbox
                            id={`feature-${feature}`}
                            checked={selectedFeatures.includes(feature)}
                            onCheckedChange={(checked) => handleFeatureChange(feature, !!checked)}
                        />
                        <Label htmlFor={`feature-${feature}`} className="text-sm font-normal cursor-pointer">
                            {featureLabels[feature] || feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                        </div>
                    ))}
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="distance">
                    <AccordionTrigger className="text-base">Max Distance</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-3">
                    <Slider
                        defaultValue={[distanceMax]}
                        min={0.5} 
                        max={20} // Max distance 20km
                        step={0.5}
                        onValueChange={(value) => setDistanceMax(value[0])}
                    />
                    <div className="text-sm text-muted-foreground text-center">
                        Up to {distanceMax} km away
                    </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="rating">
                    <AccordionTrigger className="text-base">Minimum Rating</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-3">
                    <Slider
                        defaultValue={[ratingMin]}
                        min={0} 
                        max={5} 
                        step={0.5}
                        onValueChange={(value) => setRatingMin(value[0])}
                    />
                    <div className="text-sm text-muted-foreground text-center">
                        {ratingMin > 0 ? `${ratingMin} stars & up` : "Any rating"}
                    </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button onClick={handleApply} className="w-full sm:w-auto flex-grow">Apply Filters</Button>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
        </CardFooter>
    </Card>
  );
}

// Need to add Card, CardHeader, CardTitle, CardContent, CardFooter to imports if not already imported
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
