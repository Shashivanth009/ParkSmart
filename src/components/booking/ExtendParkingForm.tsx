
"use client";
import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { addHours, format } from 'date-fns';
import type { Booking } from '@/types';
import { Clock, Loader2 } from 'lucide-react';

const extendParkingSchema = z.object({
  extendDuration: z.number().min(1, "Must extend by at least 1 hour.").max(12, "Cannot extend more than 12 hours at a time."),
});

type ExtendParkingFormValues = z.infer<typeof extendParkingSchema>;

interface ExtendParkingFormProps {
  currentBooking: Booking;
  pricePerHour: number; 
  onExtend: (newEndTime: Date, additionalCost: number, extendDuration: number) => Promise<void>; 
}

export function ExtendParkingForm({ currentBooking, pricePerHour, onExtend }: ExtendParkingFormProps) {
  const [newCalculatedEndTime, setNewCalculatedEndTime] = useState<Date | null>(null);
  const [additionalCost, setAdditionalCost] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<ExtendParkingFormValues>({
    resolver: zodResolver(extendParkingSchema),
    defaultValues: {
      extendDuration: 1,
    },
  });

  const extendDuration = form.watch("extendDuration");

  useEffect(() => {
    if (extendDuration > 0 && currentBooking.endTime && pricePerHour !== undefined) {
      const currentEndTimeDate = new Date(currentBooking.endTime);
      const newEndTime = addHours(currentEndTimeDate, extendDuration);
      setNewCalculatedEndTime(newEndTime);
      setAdditionalCost(extendDuration * pricePerHour);
    } else {
      setNewCalculatedEndTime(null);
      setAdditionalCost(0);
    }
  }, [extendDuration, currentBooking.endTime, pricePerHour]);

  async function processSubmit(values: ExtendParkingFormValues) {
    if (newCalculatedEndTime) {
      setIsSubmitting(true);
      await onExtend(newCalculatedEndTime, additionalCost, values.extendDuration);
      form.reset(); 
      setIsSubmitting(false);
    }
  }

  if(pricePerHour === undefined) {
    return <p className="text-sm text-muted-foreground text-center">Extension not available: pricing info missing.</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="extendDuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Extend By (hours)</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                defaultValue={String(field.value)}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <Clock className="mr-2 h-4 w-4 opacity-50 icon-glow" />
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[...Array(6).keys()].map(i => ( 
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} hour{i + 1 > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {newCalculatedEndTime && (
          <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-1">
            <p>Current End Time: {format(new Date(currentBooking.endTime), "PPpp")}</p>
            <p><strong>New End Time:</strong> {format(newCalculatedEndTime, "PPpp")}</p>
            <p className="font-semibold text-lg"><strong>Additional Cost:</strong> ${additionalCost.toFixed(2)}</p>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground">
            Note: Extension is subject to availability and may not always be possible.
        </p>

        <Button type="submit" className="w-full" disabled={!newCalculatedEndTime || isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Processing Extension..." : "Confirm & Pay Extension"}
        </Button>
      </form>
    </Form>
  );
}
