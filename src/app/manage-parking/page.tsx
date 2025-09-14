
"use client";
import { Suspense } from 'react';
import { ManageParkingClientContent } from '@/components/booking/ManageParkingClientContent';
import { Loader2 } from 'lucide-react';

export default function ManageParkingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ManageParkingClientContent />
    </Suspense>
  );
}
