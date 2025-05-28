
"use client";
import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { format, addHours, setHours, setMinutes, startOfHour, isBefore, parse } from 'date-fns';
import { CalendarIcon, ClockIcon, Car } from "lucide-react";
import type { ParkingSpace } from '@/types';

const bookingFormSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  startTime: z.string({ required_error: "Start time is required." }),
  duration: z.number().min(1, { message: "Duration must be at least 1 hour." }).max(24, { message: "Duration cannot exceed 24 hours." }), // hours
  vehiclePlate: z.string().optional().refine(val => !val || /^[A-Z0-9\s-]{3,10}$/i.test(val), {
    message: "Invalid vehicle plate format (3-10 alphanumeric chars)."
  }),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  space: ParkingSpace;
  onSubmit: (data: BookingFormValues, totalCost: number, endTime: Date) => void;
  defaultVehiclePlate?: string;
}

const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
};
const timeSlots = generateTimeSlots();

export function BookingForm({ space, onSubmit, defaultVehiclePlate }: BookingFormProps) {
  const [calculatedEndTime, setCalculatedEndTime] = useState<Date | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      date: startOfHour(addHours(new Date(), 1)), 
      startTime: format(startOfHour(addHours(new Date(), 1)), "HH:mm"),
      duration: 1, 
      vehiclePlate: defaultVehiclePlate || "",
    },
  });
  
  useEffect(() => {
    if (defaultVehiclePlate && defaultVehiclePlate !== form.getValues('vehiclePlate')) {
      form.setValue('vehiclePlate', defaultVehiclePlate);
    }
  }, [defaultVehiclePlate, form]);

  const selectedDate = form.watch("date");
  const selectedStartTime = form.watch("startTime");
  const selectedDuration = form.watch("duration");

  useEffect(() => {
    if (selectedDate && selectedStartTime && selectedDuration > 0 && space.pricePerHour !== undefined) {
      const [hours, minutes] = selectedStartTime.split(':').map(Number);
      const startDateTime = setMinutes(setHours(selectedDate, hours), minutes);
      
      if (isBefore(startDateTime, new Date())) {
        form.setError("startTime", { type: "manual", message: "Start time cannot be in the past." });
        setCalculatedEndTime(null);
        setTotalCost(0);
        return;
      } else {
         form.clearErrors("startTime");
      }

      const endDateTime = addHours(startDateTime, selectedDuration);
      setCalculatedEndTime(endDateTime);
      setTotalCost(selectedDuration * space.pricePerHour);
    } else {
      setCalculatedEndTime(null);
      setTotalCost(0);
    }
  }, [selectedDate, selectedStartTime, selectedDuration, space.pricePerHour, form]);

  function processSubmit(values: BookingFormValues) {
    if (calculatedEndTime && space.pricePerHour !== undefined) { 
      onSubmit(values, totalCost, calculatedEndTime);
    } else {
      form.setError("duration", {type: "manual", message: "Invalid booking time, duration, or price missing."});
    }
  }

  if (space.pricePerHour === undefined) {
    return <p className="text-destructive text-center">Pricing information for this space is currently unavailable. Booking cannot proceed.</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50 icon-glow" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) } 
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <ClockIcon className="mr-2 h-4 w-4 opacity-50 icon-glow" />
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {timeSlots.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (hours)</FormLabel>
                <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={String(field.value)}
                >
                  <FormControl>
                     <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                     </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[...Array(12).keys()].map(i => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} hour{i + 1 > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="vehiclePlate"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Vehicle Plate (Optional)</FormLabel>
                <FormControl>
                    <div className="relative">
                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground icon-glow" />
                        <Input placeholder="e.g., ABC 123" {...field} value={field.value ?? ""} className="pl-9"/>
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />


        {calculatedEndTime && (
          <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-1">
            <p><strong>Selected Start:</strong> {format(parse(selectedStartTime, 'HH:mm', selectedDate || new Date()), "PPpp")}</p>
            <p><strong>Calculated End Time:</strong> {format(calculatedEndTime, "PPpp")}</p>
            <p className="font-semibold text-lg"><strong>Total Cost:</strong> ${totalCost.toFixed(2)}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!calculatedEndTime || form.formState.isSubmitting || !!form.formState.errors.startTime}>
          {form.formState.isSubmitting ? "Processing..." : "Proceed to Payment"}
        </Button>
      </form>
    </Form>
  );
}
